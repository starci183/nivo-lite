import { Injectable, Optional } from "@nestjs/common"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { StepEffect, StepSpec } from "@modules/domain/agent-runs"
import { AgentWorkReadService } from "@modules/domain/agent-work"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectGraphThreads } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadRef, ThreadView } from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import { AgentThreadsError, AgentThreadsErrorCode } from "./errors/agent-threads.error"
import { RunStopRecordsService, runStopOf } from "./stops/run-stop-records.service"
import type { RunStop } from "./stops/run-stop.contracts"
import { RunStopsService } from "./stops/run-stops.service"
import { ThreadDeadlinesService } from "./thread-deadlines.service"
import type { ThreadRunEndParams, ThreadStepFactParams } from "./thread-projection.contracts"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadRunsService } from "./thread-runs.service"

/** How many workspaces one pass visits; the next pass takes the next slice (the old sweep's bound). */
const WORKSPACE_SLICE = 100

/** The most runs, and the most open stops, one workspace hands one pass. */
const SWEEP_PAGE = 100

/** How long a run row must have been still before the sweep looks at its thread: a drive that just began is left alone. */
const RUN_QUIET_MS = 2 * 60_000

/** How long after its deadline a stop must be before the sweep fires it itself (its own job fires first when the queue runs). */
const FIRE_GRACE_MS = 60_000

/** How long a stop must have been open before the sweep arms its deadline (the drive that stopped arms it first). */
const ARM_GRACE_MS = 2 * 60_000

/** The statuses of a run a thread still moves. */
const OPEN_RUNS: ReadonlyArray<string> = ["running", "waiting"]

/** The statuses of a run that is closed. */
const CLOSED_RUNS: ReadonlySet<string> = new Set(["done", "failed", "cancelled", "dead", "compensated"])

/** The list cursors of this service are never paged past one page. */
const LIST_SCOPE = "agent-threads.sweep"

const RUN = "agent.run"
const STEP = "agent.run-step"
const STOP = "agent.run-stop"

/** The fields of a stop the sweep reads: all of them, as the stop records read them. */
const STOP_FIELDS: ReadonlyArray<string> = [
    "runId",
    "stepKey",
    "agentId",
    "workflowId",
    "leadId",
    "conversationId",
    "kind",
    "state",
    "reason",
    "question",
    "detail",
    "cardMessageId",
    "customerLines",
    "answers",
    "decision",
    "repeats",
    "stoppedAt",
    "resolvedAt",
]

/** The fields of a step row the projection repair reads back. */
const STEP_FIELDS: ReadonlyArray<string> = [
    "stepKey",
    "nodeKey",
    "kind",
    "effect",
    "input",
    "ordinal",
    "attempt",
    "maxAttempts",
    "deadlineMs",
    "errorCode",
    "error",
    "waitItemId",
]

/** Why the sweep closed a run whose thread cannot go on. */
export type ThreadAbandonCode = "thread_never_started" | "thread_redrive_exhausted"

/** What one pass did. */
export interface ThreadSweepReport {
    /** Crashed threads written a re-drive. */
    readonly redriven: number
    /** Runs whose rows were written again from their thread. */
    readonly repaired: number
    /** Runs closed as failed because their thread cannot go on. */
    readonly abandoned: number
    /** Open stops of closed runs that were closed with them. */
    readonly closed: number
    /** Deadlines the sweep fired because their job had not. */
    readonly fired: number
}

/** A pass of another capability that rides the thread sweep, once per workspace (the lead freezes' release of their holds). */
export type ThreadSweepRider = (workspaceId: string) => Promise<void>

/** What handling one item did, for the report. */
type Done = keyof ThreadSweepReport | null

const NONE: ThreadSweepReport = { redriven: 0, repaired: 0, abandoned: 0, closed: 0, fired: 0 }

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

const numberOf = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback

const eq = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })

/** The effect a step row keeps, read back; a row with none it can read is a pivot (the safe side: nothing is ever undone). */
const effectOf = (value: unknown): StepEffect => {
    if (isRecord(value) && value.kind === "read") return { kind: "read" }
    if (isRecord(value) && value.kind === "compensable" && typeof value.compensation === "string")
        return { kind: "compensable", compensation: value.compensation }
    return { kind: "pivot" }
}

/** The step a stopped thread waits on, as its stop's question names it; null when it names none. */
const stoppedStepOf = (view: ThreadView): string | null => {
    const question: unknown = view.stop?.question
    return isRecord(question) && typeof question.stepKey === "string" ? question.stepKey : null
}

/**
 * Where a thread stands, as one key: how many steps it holds, where it goes next and how many words it was given. A re-drive is written
 * once per key, so a thread that crashes again at the same place is not re-driven a second time.
 */
export const threadPositionOf = (view: ThreadView): string =>
    `${String(Object.keys(view.state.steps).length)}.${view.next.join("+") || "none"}.${String(view.state.founderAnswers.length)}`

/** The language of a run's cards, read from its trigger. */
const localeOf = (view: ThreadView | null): "vi" | "en" => {
    const trigger: unknown = view?.state.trigger
    return isRecord(trigger) && trigger.locale === "en" ? "en" : "vi"
}

@Injectable()
/**
 * The backstop of the thread runs, one bounded pass a minute over a slice of the workspaces. It is the database's word against the
 * threads', and it moves no stop:
 *
 * - CRASHED threads only are re-driven: the thread has unfinished work and no interrupt (status `open`), its run row has been still for
 *   two minutes and no wake that could move it (the run's own wake, or a wake naming the run) is pending, running or held. A stopped
 *   (interrupted) thread is never re-driven: only a decision moves a stop. The re-drive is a wake of the run's scope (`redrive`), once per
 *   position of the thread; it runs the same node function, where every recorded call answers from the ledger and an outcome-unknown
 *   code becomes a stop for a person, so an effect whose outcome is unknown is never run again by the machine. A thread that crashes
 *   again at a place it was already re-driven from, with that wake gone, is closed as failed (`thread_redrive_exhausted`): its dead wake
 *   was told to the founder once, by the flow.
 * - PROJECTION repair: a thread that ended while its run row still reads open closes the row (done, or skipped by the founder whose
 *   decision the stop keeps); a stopped thread whose run row still reads running gets the stop's step fact written again from the step
 *   row; a run with no thread at all and no live wake (its start never got a checkpoint) is closed as failed (`thread_never_started`).
 * - STOPS of a run that is closed are closed with it (their cards rewritten, no live button on a failed run). Open stops get their
 *   deadline armed when the drive that stopped did not, and a deadline whose job has not fired is fired here.
 *
 * One failing item never stops the rest; each is logged with its kind.
 */
export class ThreadSweepService {
    /** The last workspace of the previous slice. */
    private after: string | undefined

    /** The passes that ride this sweep, per workspace. */
    private readonly riders: Array<ThreadSweepRider> = []

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly engine: EntityEngineService,
        private readonly records: RunStopRecordsService,
        private readonly stops: RunStopsService,
        private readonly projection: ThreadProjectionService,
        private readonly runs: ThreadRunsService,
        private readonly deadlines: ThreadDeadlinesService,
        @Optional() @InjectGraphThreads() private readonly port?: GraphThreads,
        @Optional() private readonly wakes?: AgentWorkReadService,
        @Optional() private readonly workspaces?: WorkspacesService,
    ) {}

    /**
     * Adds a pass run once per workspace after the threads' own (the lead freezes register their release here, so the threads import
     * nothing of them). A failing rider is logged and never stops the sweep.
     */
    alsoPerWorkspace(rider: ThreadSweepRider): void {
        this.riders.push(rider)
    }

    /**
     * One pass over the next slice of workspaces; nothing in an app with no threads port.
     */
    async sweep(): Promise<ThreadSweepReport> {
        if (this.port === undefined || this.workspaces === undefined) return NONE
        const found = await this.workspaces.list(WORKSPACE_SLICE, this.after)
        this.after = found.length < WORKSPACE_SLICE ? undefined : found.at(-1)?.id
        const reports: Array<ThreadSweepReport> = []
        await eachInOrder(found, async (workspace) => {
            reports.push(await this.sweepWorkspace(workspace.id))
        })
        const total = (kind: keyof ThreadSweepReport): number => reports.reduce((sum, one) => sum + one[kind], 0)
        const report: ThreadSweepReport = {
            redriven: total("redriven"),
            repaired: total("repaired"),
            abandoned: total("abandoned"),
            closed: total("closed"),
            fired: total("fired"),
        }
        this.logger.info(AgentThreadsLogEvent.SweepDone, { ...report })
        return report
    }

    /** One workspace: its open thread runs, then its open stops. A failing workspace reports nothing and never stops the rest. */
    async sweepWorkspace(workspaceId: string): Promise<ThreadSweepReport> {
        if (this.port === undefined) return NONE
        const done: Array<Done> = []
        try {
            const runs = await this.openRuns(workspaceId)
            await eachInOrder(runs, async (row) => {
                done.push(await this.guarded("run", row.id, () => this.run(workspaceId, row)))
            })
            const open = await this.openStops(workspaceId)
            await eachInOrder(open, async (stop) => {
                done.push(await this.guarded("stop", stop.runId, () => this.stop(workspaceId, stop)))
            })
        } catch (cause) {
            this.logger.error(AgentThreadsLogEvent.SweepItemFailed, cause, { kind: "workspace", workspaceId })
        }
        await eachInOrder(this.riders, async (rider) => {
            try {
                await rider(workspaceId)
            } catch (cause) {
                this.logger.error(AgentThreadsLogEvent.SweepItemFailed, cause, { kind: "rider", workspaceId })
            }
        })
        const count = (kind: keyof ThreadSweepReport): number => done.filter((one) => one === kind).length
        return {
            redriven: count("redriven"),
            repaired: count("repaired"),
            abandoned: count("abandoned"),
            closed: count("closed"),
            fired: count("fired"),
        }
    }

    private async guarded(kind: string, runId: string, work: () => Promise<Done>): Promise<Done> {
        try {
            return await work()
        } catch (cause) {
            this.logger.error(AgentThreadsLogEvent.SweepItemFailed, cause, { kind, runId })
            return null
        }
    }

    /** One open thread run whose row has been still a while. */
    private async run(workspaceId: string, row: RecordRow): Promise<Done> {
        const port = this.portOf()
        const ref: ThreadRef = { workspaceId, runId: row.id }
        const view = await port.stateOf(ref)
        if (view === null) return this.neverStarted(ref, row)
        if (view.status === "ended") return this.endedRepair(ref)
        if (view.status === "stopped")
            return row.data.status === "running" ? this.stoppedRepair(ref, view) : null
        return this.crashed(ref, row, view)
    }

    /** A thread with unfinished work and no interrupt that nobody drives: one re-drive per position, then the run is closed. */
    private async crashed(ref: ThreadRef, row: RecordRow, view: ThreadView): Promise<Done> {
        if (await this.live(ref, row)) return null
        const admission = await this.runs.redrive(ref, threadPositionOf(view))
        if (admission.kind === "refused") return null
        if (admission.fresh) {
            this.logger.info(AgentThreadsLogEvent.ThreadRedriven, { runId: ref.runId, position: threadPositionOf(view) })
            return "redriven"
        }
        return this.abandoned(ref, view, "thread_redrive_exhausted")
    }

    /** A run whose thread never got a checkpoint and whose wake is gone: it cannot start any more. */
    private async neverStarted(ref: ThreadRef, row: RecordRow): Promise<Done> {
        if (await this.live(ref, row)) return null
        return this.abandoned(ref, null, "thread_never_started")
    }

    private async abandoned(ref: ThreadRef, view: ThreadView | null, code: ThreadAbandonCode): Promise<Done> {
        await this.projection.runEnded(ref, { outcome: "failed", code, by: null, at: this.clock.now() })
        await this.stops.runClosed(ref, { locale: localeOf(view) })
        this.logger.warn(AgentThreadsLogEvent.ThreadAbandoned, { runId: ref.runId, code })
        return "abandoned"
    }

    /** A thread that ended while its run row still reads open: the row closes as the thread did. */
    private async endedRepair(ref: ThreadRef): Promise<Done> {
        const stops = await this.records.ofRun(ref.workspaceId, ref.runId)
        const skipped = stops.find((stop) => stop.decision?.kind === "skip")?.decision ?? null
        const end: ThreadRunEndParams =
            skipped === null
                ? { outcome: "done", code: null, by: null, at: this.clock.now() }
                : { outcome: "skipped", code: "skipped_by_founder", by: skipped.by, at: new Date(skipped.at) }
        return this.repaired(ref, await this.projection.runEnded(ref, end))
    }

    /** A stopped thread whose run row reads running: the stop's step fact is written again from the step row it already has. */
    private async stoppedRepair(ref: ThreadRef, view: ThreadView): Promise<Done> {
        const stepKey = stoppedStepOf(view)
        if (stepKey === null) return null
        const row = await this.stepRowOf(ref, stepKey)
        if (row === null) return null
        const stop = await this.stops.stopOf(ref, stepKey)
        const data = row.data
        const spec: StepSpec = {
            stepKey,
            nodeKey: textOf(data.nodeKey) ?? stepKey,
            kind: textOf(data.kind) ?? "graph_node",
            effect: effectOf(data.effect),
            input: isRecord(data.input) ? data.input : {},
            ...(typeof data.maxAttempts === "number" ? { maxAttempts: data.maxAttempts } : {}),
            ...(typeof data.deadlineMs === "number" ? { deadlineMs: data.deadlineMs } : {}),
        }
        const fact: ThreadStepFactParams = {
            kind: "stopped",
            spec,
            ordinal: numberOf(data.ordinal, 1),
            attempt: numberOf(data.attempt, 1),
            at: stop === null ? this.clock.now() : new Date(stop.stoppedAt),
            code: textOf(data.errorCode) ?? stop?.kind ?? "stopped",
            error: isRecord(data.error) ? data.error : null,
            calls: [],
            waitItemId: textOf(data.waitItemId),
        }
        return this.repaired(ref, await this.projection.repair(ref, { steps: [fact], end: null }))
    }

    private repaired(ref: ThreadRef, outcome: string): Done {
        if (outcome !== "written") return null
        this.logger.info(AgentThreadsLogEvent.ProjectionRepaired, { runId: ref.runId })
        return "repaired"
    }

    /** One open stop: closed with its run when the run is closed; else its deadline armed, or fired when its job has not. */
    private async stop(workspaceId: string, stop: RunStop): Promise<Done> {
        const ref: ThreadRef = { workspaceId, runId: stop.runId }
        const run = await this.engine.scoped(workspaceId, (tx) => this.engine.get(tx, RUN, stop.runId))
        if (run === null || CLOSED_RUNS.has(textOf(run.data.status) ?? "")) {
            const closed = await this.stops.runClosed(ref, { locale: localeOf(await this.portOf().stateOf(ref)) })
            return closed > 0 ? "closed" : null
        }
        const deadline = await this.deadlines.dueOf(ref, stop)
        if (deadline === null) return null
        const now = this.clock.now().getTime()
        if (deadline.at.getTime() <= now - FIRE_GRACE_MS)
            return (await this.deadlines.fire(deadline.payload)) === "admitted" ? "fired" : null
        if (new Date(stop.stoppedAt).getTime() <= now - ARM_GRACE_MS) await this.deadlines.armed(ref, stop.stepKey)
        return null
    }

    /** Whether a wake that could still move the run is alive; without the work core's reader, assume one is (never re-drive blind). */
    private async live(ref: ThreadRef, row: RecordRow): Promise<boolean> {
        if (this.wakes === undefined) return true
        const agentId = textOf(row.data.agentId)
        if (agentId === null) return true
        return this.wakes.hasLiveWake(ref.workspaceId, agentId, { wakeId: textOf(row.data.wakeId), subjectId: ref.runId })
    }

    /** The thread runs of the workspace that read running or waiting and whose row has been still for a while. */
    private async openRuns(workspaceId: string): Promise<ReadonlyArray<RecordRow>> {
        const quietBefore = this.clock.now().getTime() - RUN_QUIET_MS
        const order: OrderBy = [
            ["resumeNotBefore", "asc"],
            ["id", "asc"],
        ]
        const rows: Array<RecordRow> = []
        await eachInOrder(OPEN_RUNS, async (status) => {
            const page = await this.engine.scoped(workspaceId, (tx) =>
                this.engine.list(
                    tx,
                    {
                        from: RUN,
                        select: ["agentId", "wakeId", "status", "engine"],
                        where: { op: "and", of: [eq("status", status), { op: "in", field: "engine", values: ["langgraph"] }] },
                        order,
                        page: { size: SWEEP_PAGE },
                    },
                    LIST_SCOPE,
                ),
            )
            rows.push(...page.rows.map((listed) => listed.row))
        })
        return rows.filter((row) => new Date(row.updatedAt).getTime() <= quietBefore)
    }

    /** The open stops of the workspace, newest first. */
    private async openStops(workspaceId: string): Promise<ReadonlyArray<RunStop>> {
        const page = await this.engine.scoped(workspaceId, (tx) =>
            this.engine.list(
                tx,
                {
                    from: STOP,
                    select: STOP_FIELDS,
                    where: eq("state", "open"),
                    order: [
                        ["stoppedAt", "desc"],
                        ["id", "desc"],
                    ],
                    page: { size: SWEEP_PAGE },
                },
                LIST_SCOPE,
            ),
        )
        return page.rows.map((listed) => runStopOf(listed.row))
    }

    /** The row of one step of a run, read through the run's ordinal index as the projection reads it. */
    private async stepRowOf(ref: ThreadRef, stepKey: string): Promise<RecordRow | null> {
        const page = await this.engine.scoped(ref.workspaceId, (tx) =>
            this.engine.list(
                tx,
                {
                    from: STEP,
                    select: STEP_FIELDS,
                    where: eq("runId", ref.runId),
                    order: [
                        ["ordinal", "asc"],
                        ["id", "asc"],
                    ],
                    page: { size: SWEEP_PAGE },
                },
                LIST_SCOPE,
            ),
        )
        return page.rows.map((listed) => listed.row).find((row) => row.data.stepKey === stepKey) ?? null
    }

    private portOf(): GraphThreads {
        if (this.port === undefined) throw new AgentThreadsError({ code: AgentThreadsErrorCode.PortMissing })
        return this.port
    }
}
