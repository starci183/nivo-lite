import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { InjectGraphThreads } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadRef } from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { ThreadDeadlineQueue } from "@modules/queues/thread-deadline"
import type { ThreadDeadlinePayload } from "@modules/queues/thread-deadline"
import { InjectAgentThreadsOptions } from "./agent-threads.decorators"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import type { AgentThreadsOptions } from "./agent-threads.options"
import type { RunStop } from "./stops/run-stop.contracts"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import { RunStopsService } from "./stops/run-stops.service"
import { ThreadApprovalsService } from "./thread-approvals.service"
import { deadlineAtOf, deadlineWindowOf } from "./thread-deadline.policy"
import { ThreadRunsService } from "./thread-runs.service"

/** What arming the deadline of a stop did: a job was written (or already stood), no deadline applies, or this app has no queue. */
export type DeadlineArming = "armed" | "none" | "unqueued"

/**
 * What a deadline that came did: it answered the stop `timeout` (admitted as a wake of the run), the stop no longer stands as it was
 * armed for (`closed`: resolved or gone; `moved`: answered or stopped again since), the deadline is not due yet (`early`: fired
 * by the sweep when it is), or the thread refused the timeout (`refused`).
 */
export type DeadlineFiring = "admitted" | "closed" | "moved" | "early" | "refused"

/** A stop's deadline: when it comes and the job that carries it. */
export interface StopDeadline {
    /** When the deadline comes. */
    readonly at: Date
    /** The job's payload: the stop as it stood when the deadline was set. */
    readonly payload: ThreadDeadlinePayload
}

/** An open stop with the deadline that stands for it. */
export interface PendingDeadline {
    /** The stop. */
    readonly stop: RunStop
    /** Its deadline. */
    readonly deadline: StopDeadline
}

@Injectable()
/**
 * The deadlines of the stops of thread runs, as NIVO jobs, never a timer inside LangGraph. When a drive leaves a thread stopped, a
 * delayed job is written for its stop (24 hours for an approval, 3 days for a stop that waits for the founder, or the wait the template
 * declares for the step; none for an engine stop, and one deadline per stop at most). When the job comes, the stop is answered `timeout`
 * through `ThreadRunsService.resume`, the same door a founder's decision takes, so it queues behind the run's lease; an approval's
 * deadline goes through `ThreadApprovalsService.expired`, which also closes the owner's item as refused by the engine. A deadline is keyed
 * by the stop as it stood (its repeat and its count of answers): a deadline that comes for a stop already closed, answered or stopped
 * again since does nothing. The thread sweep arms the deadlines a crash missed and fires the ones whose job was lost (`dueOf`).
 */
export class ThreadDeadlinesService implements OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAgentThreadsOptions() private readonly options: AgentThreadsOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly stops: RunStopsService,
        private readonly runs: ThreadRunsService,
        @Optional() private readonly queue?: ThreadDeadlineQueue,
        @Optional() private readonly graphs?: AgentGraphsService,
        @Optional() @InjectGraphThreads() private readonly port?: GraphThreads,
        @Optional() private readonly approvals?: ThreadApprovalsService,
        @Optional() private readonly records?: RunStopRecordsService,
    ) {}

    /** Arms the deadline of every stop a drive leaves behind. */
    onModuleInit(): void {
        this.runs.whenStopped(async (ref, stepKey) => {
            await this.armed(ref, stepKey)
        })
    }

    /** Writes the deadline job of the open stop of a step; arming the same stop again writes nothing new (the job is keyed by the stop). */
    async armed(ref: ThreadRef, stepKey: string): Promise<DeadlineArming> {
        const stop = await this.stops.stopOf(ref, stepKey)
        const deadline = stop?.state === "open" ? await this.dueOf(ref, stop) : null
        if (deadline === null) return "none"
        const delayMs = deadline.at.getTime() - this.clock.now().getTime()
        const queued = await this.entityManager.transaction((tx) => this.armIn(tx, deadline.payload, delayMs))
        if (!queued) return "unqueued"
        this.logger.info(AgentThreadsLogEvent.DeadlineArmed, {
            runId: ref.runId,
            stepKey,
            dueAt: deadline.at.toISOString(),
        })
        return "armed"
    }

    /** The deadline of an open stop as it stands, or null when none applies (an engine stop, a stop a deadline already answered). */
    async dueOf(ref: ThreadRef, stop: RunStop): Promise<StopDeadline | null> {
        const windowMs = deadlineWindowOf(stop, await this.templateWaitOf(ref, stop), {
            approvalMs: this.options.approvalDeadlineMs,
            ownerMs: this.options.ownerDeadlineMs,
        })
        if (windowMs === null) return null
        return {
            at: deadlineAtOf(stop, windowMs),
            payload: {
                workspaceId: ref.workspaceId,
                runId: ref.runId,
                stepKey: stop.stepKey,
                repeats: stop.repeats,
                answered: stop.answers.length,
            },
        }
    }

    /**
     * A deadline came: the stop is answered `timeout` when it still stands exactly as it did when the deadline was armed (open, the same
     * repeat, the same answers) and the deadline is due; else nothing happens (a deadline not due yet is left to the minute sweep).
     */
    async fire(payload: ThreadDeadlinePayload): Promise<DeadlineFiring> {
        return this.fireAs(payload, false)
    }

    /**
     * A person runs the deadline now ("run now" on the schedule list): the same answer `fire` gives when the deadline comes, given now,
     * for the stop exactly as the job was armed for (`payload`, whose key is the job's dedupe key). The delayed job stays where it is and
     * does nothing when it comes, because the stop no longer stands as it was armed for (`moved`). A stop closed or moved since answers so.
     */
    fireNow(payload: ThreadDeadlinePayload): Promise<DeadlineFiring> {
        return this.fireAs(payload, true)
    }

    /**
     * The deadlines of the newest open stops of the workspace (at most `limit`), soonest first; a stop no deadline applies to is left
     * out. A list for people (the schedule list), never on a customer's path: it reads each thread's pinned template.
     */
    async pending(workspaceId: string, limit: number): Promise<ReadonlyArray<PendingDeadline>> {
        if (this.records === undefined) return []
        const open = await this.records.newest(workspaceId, "open", limit)
        const found: Array<PendingDeadline> = []
        await eachInOrder(open, async (stop) => {
            const deadline = await this.dueOf({ workspaceId, runId: stop.runId }, stop)
            if (deadline !== null) found.push({ stop, deadline })
        })
        return found.toSorted((a, b) => a.deadline.at.getTime() - b.deadline.at.getTime())
    }

    private async fireAs(payload: ThreadDeadlinePayload, now: boolean): Promise<DeadlineFiring> {
        const ref: ThreadRef = { workspaceId: payload.workspaceId, runId: payload.runId }
        const stop = await this.stops.stopOf(ref, payload.stepKey)
        if (stop?.state !== "open") return this.skipped(payload, "closed")
        if (stop.repeats !== payload.repeats || stop.answers.length !== payload.answered) return this.skipped(payload, "moved")
        const deadline = await this.dueOf(ref, stop)
        if (deadline === null) return this.skipped(payload, "moved")
        const at = this.clock.now()
        // Not due yet (the app's window grew since it was armed): the minute sweep fires it when it is. A person's "run now" is due now.
        if (!now && deadline.at.getTime() > at.getTime()) return this.skipped(payload, "early")
        // An approval's deadline also closes the owner's item as refused by the engine (package 1-3); its verdict hands the timeout on.
        const admission =
            stop.kind === "approval" && this.approvals !== undefined
                ? await this.approvals.expired(ref, stop.stepKey, this.runs)
                : await this.runs.resume(ref, { kind: "timeout", at: at.toISOString() })
        if (admission === null) return this.skipped(payload, "closed")
        if (admission.kind === "refused") return this.skipped(payload, "refused")
        this.logger.info(AgentThreadsLogEvent.DeadlineFired, { runId: payload.runId, stepKey: payload.stepKey, early: now })
        return "admitted"
    }

    private armIn(tx: EntityManager, payload: ThreadDeadlinePayload, delayMs: number): Promise<boolean> {
        return this.queue === undefined ? Promise.resolve(false) : this.queue.arm(payload, delayMs, tx)
    }

    private skipped(payload: ThreadDeadlinePayload, code: Exclude<DeadlineFiring, "admitted">): DeadlineFiring {
        this.logger.info(AgentThreadsLogEvent.DeadlineSkipped, { runId: payload.runId, stepKey: payload.stepKey, code })
        return code
    }

    /**
     * The wait the template declares for the stopped step (`wait.timeout`), read from the version the thread is pinned to; undefined when
     * it declares none or the version cannot be read (the kind's window then applies).
     */
    private async templateWaitOf(ref: ThreadRef, stop: RunStop): Promise<string | undefined> {
        if (this.port === undefined || this.graphs === undefined) return undefined
        try {
            const seen = await this.port.stateOf(ref)
            if (seen === null) return undefined
            const { document } = await this.graphs.versionAt(ref.workspaceId, stop.agentId, seen.version)
            return document.flow?.nodes.find((node) => node.key === stop.stepKey)?.wait?.timeout
        } catch {
            this.logger.warn(AgentThreadsLogEvent.DeadlineSkipped, { runId: ref.runId, code: "template_unreadable" })
            return undefined
        }
    }
}
