import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { THREAD_SCOPE_MEMBER } from "@modules/domain/agent-graphs"
import { AgentRunsService, AgentRunsViewService } from "@modules/domain/agent-runs"
import { AgentWakeService, AgentWorkReadService } from "@modules/domain/agent-work"
import { CustomerRoutesService } from "@modules/domain/customer-routes/customer-routes.service"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import type { OptionalRunStop, RunStop, StopDecision } from "./stops/run-stop.contracts"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import { stopDecisionOf } from "./stops/stop-gate.policy"
import type { ThreadWakeAdmission, ThreadWakeRefusal } from "./thread-runs.service"
import {
    LEGACY_THREAD_WAKE_SOURCE,
    THREAD_RESUME_EVENT,
    THREAD_WAKE_SOURCE,
    resumeOnceKeyOf,
    sameResumeCarry,
    wakeActorOf,
    type ResumeCarry,
} from "./thread-wakes.policy"

/** The stop a decision answers: the run, and its step (absent or null: the run's open stop that stopped last). */
export interface ThreadResumeRef {
    /** The workspace. */
    readonly workspaceId: string
    /** The run (the thread). */
    readonly runId: string
    /** The step whose stop is answered; absent or null answers the run's newest open stop. */
    readonly stepKey?: string | null | undefined
}

/** The status a run's row holds while its thread waits for a person (the projection writes it when a step stops, and after a take-over). */
const WAITING = "waiting"

/** The run's newest open stop, or null. */
const newestOpenOf = (stops: ReadonlyArray<RunStop>): OptionalRunStop =>
    stops.filter((stop) => stop.state === "open").toSorted((a, b) => b.stoppedAt.localeCompare(a.stoppedAt))[0] ?? null

/**
 * The route whose staff hold a decision ends (rulings R51, R52): the stop's route when a person took the stop over (its last decision is
 * `take_over`) and this decision is any other one; null otherwise (a stop never taken over, a take-over again, a run about no route).
 */
export const heldRouteEndedBy = (stop: Pick<RunStop, "decision" | "conversationId">, decision: StopDecision): string | null =>
    stop.decision?.kind === "take_over" && decision.kind !== "take_over" ? stop.conversationId : null

@Injectable()
/**
 * The ONE door a decision on a stop goes through (the founder's words, a button, an owner's verdict, a deadline), in the engine's
 * vocabulary a RESUME REQUEST: it is admitted from the STORES alone and handed off, never applied here.
 *
 * ADMISSION (stores only: the run row, its engine, the stop row; no checkpoint, so an app with no LangGraph serves it): the decision is
 * one the stops read, the run exists, is a thread's and names its scope, the stop of the step is open, and the run's row says it waits
 * for a person (a stop whose step runs again after an earlier answer takes no decision until it waits again).
 *
 * RECORD + HAND-OFF: the decision is recorded as ONE resume wake of the run's own scope (payload: the decision with who and when, the step
 * and how many answers the stop held; the actor column: the member), written with its drain job in the caller's transaction (or its
 * own), so it survives a restart and queues behind whatever holds the run's lease. The once-key `thread:<run>:<step>:<answers>` fences
 * the stop state: the same decision again is `admitted` with `fresh: false`, a DIFFERENT one loses as `already_answered`.
 *
 * The api's drain then runs the wake (`ThreadRunsService.woken`), which checks the checkpoint as the second guard before it resumes.
 *
 * TAKE-OVER END (rulings R51, R52): a decision other than a take-over on a stop a person took over (its last decision `take_over`) closes
 * that take-over, whoever sends it (a retry, the founder's words, a skip, the run page's cancel, a hand-back): the staff hold the take-over
 * set on the stop's route is cleared in the same transaction as the wake, so a step run again can send, and a skipped run never leaves a
 * held route with no hand-back button on its card. One rule, here, for every caller.
 */
export class ThreadResumeRequestsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly runs: AgentRunsService,
        private readonly view: AgentRunsViewService,
        private readonly wakes: AgentWakeService,
        private readonly records: RunStopRecordsService,
        @Optional() private readonly wakeReader?: AgentWorkReadService,
        @Optional() private readonly routes?: CustomerRoutesService,
    ) {}

    /** Admits a decision on a stop from the stores and records it as the run's resume wake; refused, with nothing written, otherwise. */
    async resume(ref: ThreadResumeRef, value: unknown, tx?: EntityManager): Promise<ThreadWakeAdmission> {
        const decision = stopDecisionOf(value)
        if (decision === null) return this.refused(ref, "decision_invalid")
        const run = await this.runs.runOf(ref.workspaceId, ref.runId)
        if (run === null) return this.refused(ref, "run_missing")
        const detail = await this.view.detail(ref.workspaceId, run.agentId, ref.runId)
        if (detail?.engine !== "langgraph") return this.refused(ref, "run_not_thread")
        const scopeKey: unknown = run.context[THREAD_SCOPE_MEMBER]
        if (typeof scopeKey !== "string" || scopeKey === "") return this.refused(ref, "scope_unknown")
        const stop = await this.stopOf(ref)
        if (stop?.state !== "open" || detail.run.status !== WAITING) return this.refused(ref, "thread_not_stopped")
        const carry: ResumeCarry = { decision, stepKey: stop.stepKey, answered: stop.answers.length }
        const eventKey = resumeOnceKeyOf(ref.runId, carry)
        const text = JSON.stringify(carry)
        const write = async (manager: EntityManager) => {
            const written = await this.wakes.write(manager, {
                workspaceId: ref.workspaceId,
                agentId: run.agentId,
                source: THREAD_WAKE_SOURCE,
                eventKey,
                scopeKey,
                context: { eventName: THREAD_RESUME_EVENT, subjectId: ref.runId, tagContext: text },
                actorMemberId: wakeActorOf(decision),
            })
            const route = written === null ? null : heldRouteEndedBy(stop, decision)
            if (route !== null) await this.routes?.release(ref.workspaceId, route, manager)
            return written
        }
        const id = tx === undefined ? await this.entityManager.transaction(write) : await write(tx)
        this.logger.info(AgentThreadsLogEvent.WakeAdmitted, { runId: ref.runId, event: THREAD_RESUME_EVENT, fresh: id !== null })
        if (id !== null) return { kind: "admitted", fresh: true }
        return (await this.sameDecisionKept(ref.workspaceId, run.agentId, eventKey, text))
            ? { kind: "admitted", fresh: false }
            : this.refused(ref, "already_answered")
    }

    /** The stop the decision answers: the named step's, else the run's newest open stop. */
    private async stopOf(ref: ThreadResumeRef): Promise<OptionalRunStop> {
        const stepKey = ref.stepKey ?? null
        if (stepKey !== null) return this.records.byRunStep(ref.workspaceId, ref.runId, stepKey)
        return newestOpenOf(await this.records.ofRun(ref.workspaceId, ref.runId))
    }

    /**
     * Whether the wake already written for this stop state carries this very decision (read after the unique key settled the race);
     * without the work core's reader (a test world) the earlier wake is taken as this one.
     */
    private async sameDecisionKept(workspaceId: string, agentId: string, eventKey: string, text: string): Promise<boolean> {
        if (this.wakeReader === undefined) return true
        const kept = await this.wakeReader.wakeContextOf(workspaceId, agentId, THREAD_WAKE_SOURCE, eventKey)
        // A wake of the same key written under the old source before the switch.
        const context = kept ?? (await this.wakeReader.wakeContextOf(workspaceId, agentId, LEGACY_THREAD_WAKE_SOURCE, eventKey))
        return context !== null && sameResumeCarry(context.tagContext, text)
    }

    private refused(ref: ThreadResumeRef, code: ThreadWakeRefusal): ThreadWakeAdmission {
        this.logger.warn(AgentThreadsLogEvent.WakeRefused, { runId: ref.runId, code })
        return { kind: "refused", code }
    }
}
