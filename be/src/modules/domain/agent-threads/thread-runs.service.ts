import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    AgentGraphFlowRunsService,
    AgentWorkflowRunsService,
    THREAD_SCOPE_MEMBER,
    namespaceOf,
    type FlowThreadRun,
    type FlowThreads,
} from "@modules/domain/agent-graphs"
import { AgentRunsService, AgentRunsViewService } from "@modules/domain/agent-runs"
import {
    AgentWakeService,
    AgentWorkReadService,
    type AgentHandlerEnding,
    type AgentTurnView,
} from "@modules/domain/agent-work"
import {
    InjectGraphThreads,
    LanggraphError,
    LanggraphErrorCode,
    type GraphThreads,
    type ThreadGraph,
    type ThreadLease,
    type ThreadOutcome,
    type ThreadRef,
    type ThreadView,
} from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, withRunScope, type Logger } from "@modules/platform/logging"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import { AgentThreadsError, AgentThreadsErrorCode } from "./errors/agent-threads.error"
import { RunStopsService } from "./stops/run-stops.service"
import { answerIndexOf, endsTheRun, stopAnswerOf } from "./stops/stop-gate.policy"
import type { StopDecision } from "./stops/run-stop.contracts"
import { ThreadGraphsService, type DrivenRun } from "./thread-graphs.service"
import { ThreadProjectionService } from "./thread-projection.service"
import { UNTIL_PARK_KIND, parkOfQuestion, type UntilPark, type UntilRoundDecision } from "./until-rounds.policy"
import { WAIT_PARK_KIND, eventOf, parkOfWaitQuestion, waitOnceKeyOf, type WaitCame, type WaitDecision } from "./thread-waits.policy"
import {
    LEGACY_THREAD_WAKE_SOURCE,
    THREAD_RESUME_EVENT,
    THREAD_WAKE_SOURCE,
    resumeCarryOf,
    type ResumeCarry,
} from "./thread-wakes.policy"

/** Told when a drive left a thread stopped for a person at a step (the deadlines arm here); it never fails the wake. */
export type ThreadStoppedListener = (ref: ThreadRef, stepKey: string) => Promise<void>

/**
 * Told after every drive that settled a thread (it stopped, or it ended): a capability above the threads (the subject holds, which
 * release the wakes held behind a finished run) registers here, so the threads import nothing of it. It never fails the wake.
 */
export type ThreadSettledListener = (ref: ThreadRef) => Promise<void>

/** The source a wait's wake is written under (the thread's own): what `sameWaitKept` reads it back by. */
const THREAD_WAIT_EVENT_SOURCE = THREAD_WAKE_SOURCE

/** The event of a wake that continues a thread whose drive was cut. */
export const THREAD_DRIVE_EVENT = "engine.thread.drive"

/** The event of a wake that starts the next round of a `loop({ until, every })` parked between two rounds (its timer came). */
export const THREAD_ROUND_EVENT = "engine.thread.round"

/** The event of a wake that resumes a thread parked on a `wait` with what came (an event it takes, or its timeout). */
export const THREAD_WAIT_EVENT = "engine.thread.wait"

/** What a wait wake carries: the park it answers, what came, and the wake of the event (when one came); null when unreadable. */
interface WaitCarry {
    readonly parkKey: string
    readonly came: WaitCame
    readonly wakeId: string | null
}

/** What came to a wait, read from a wake's context: the timeout, or an event under a trigger's key; null when it is neither. */
const cameOf = (came: Readonly<Record<string, unknown>>): WaitCame | null => {
    if (came.timeout === true) return { timeout: true }
    return typeof came.key === "string" && isRecord(came.event) ? { key: came.key, event: eventOf(came.event) } : null
}

const waitCarryOf = (text: string | undefined): WaitCarry | null => {
    const read = text === undefined ? null : parseJsonText(text)
    if (read === null || !read.ok || !isRecord(read.value)) return null
    const { parkKey, came, wakeId } = read.value
    if (typeof parkKey !== "string" || !isRecord(came)) return null
    const what = cameOf(came)
    return what === null ? null : { parkKey, came: what, wakeId: typeof wakeId === "string" ? wakeId : null }
}

/** What a round wake carries: the park it answers, read back from its context; null when it is not what `roundDue` wrote. */
const roundCarryOf = (text: string | undefined): Pick<UntilPark, "parkKey" | "round"> | null => {
    const read = text === undefined ? null : parseJsonText(text)
    if (read === null || !read.ok || !isRecord(read.value)) return null
    const { parkKey, round } = read.value
    return typeof parkKey === "string" && typeof round === "number" ? { parkKey, round } : null
}

/** What a decision or a re-drive was refused for before any wake was written. */
export type ThreadWakeRefusal =
    | "decision_invalid"
    | "run_missing"
    | "run_not_thread"
    | "thread_absent"
    | "thread_not_stopped"
    | "thread_ended"
    | "scope_unknown"
    | "already_answered"

/** A decision or a re-drive a wake of the run's scope now carries: the drain runs it under the lease. */
export interface ThreadWakeAdmitted {
    /** It was admitted. */
    readonly kind: "admitted"
    /** False when the same wake was already written (the same decision for the same stop, the same re-drive key). */
    readonly fresh: boolean
}

/** A decision or a re-drive that was refused: nothing was written. */
export interface ThreadWakeRefused {
    /** It was refused. */
    readonly kind: "refused"
    /** Why. */
    readonly code: ThreadWakeRefusal
}

/** What became of a decision or a re-drive handed to the thread runs. */
export type ThreadWakeAdmission = ThreadWakeAdmitted | ThreadWakeRefused

/** A run a wake may be written for: a thread's, with a checkpoint, that names its scope. */
interface AdmissibleRun {
    readonly kind: "ok"
    readonly agentId: string
    readonly scopeKey: string
    readonly seen: ThreadView
}

/** The wake to write for a run. */
interface WakeDraft {
    readonly eventKey: string
    readonly eventName: string
    readonly carry: string | null
    readonly actorMemberId: string | null
}

/** One drive of a thread: the turn whose lease covers it, the thread, its run's facts and the decision it applies, if any. */
interface Drive {
    readonly turn: AgentTurnView
    readonly signal: AbortSignal
    readonly ref: ThreadRef
    readonly run: DrivenRun
    readonly decision: StopDecision | null
}

const doneOf = (runId: string): AgentHandlerEnding => ({ status: "done", reason: null, outcome: { runId } })

/**
 * A value as plain JSON, the way JSON would write it: what a checkpoint stores and reads back the same. An `undefined` member is
 * dropped, a date becomes its ISO text, anything JSON has no word for becomes null.
 */
const plainOf = (value: unknown): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map((item: unknown) => plainOf(item))
    if (!isRecord(value)) return null
    return Object.fromEntries(
        Object.entries(value)
            .filter(([, member]) => member !== undefined)
            .map(([key, member]) => [key, plainOf(member)]),
    )
}

const isFenced = (cause: unknown): boolean =>
    cause instanceof LanggraphError && cause.code === LanggraphErrorCode.CheckpointFenced

/** The step a stopped thread waits on, as its stop's question names it; null for a thread that waits on nothing it can read. */
const stoppedStepOf = (seen: ThreadView): string | null => {
    const question: unknown = seen.stop?.question
    return seen.status === "stopped" && isRecord(question) && typeof question.stepKey === "string" ? question.stepKey : null
}

@Injectable()
/**
 * The runs of workflows on LangGraph threads: one thread per run, the run id is the thread id.
 *
 * ONE DRIVER PER THREAD. The library has no lock, so every `start`, `resume` and `drive` of the port happens inside a turn of the
 * work core: the drain took the lease of the run's scope (`agent_work_leases`), renews it on its heartbeat while the drive runs and
 * aborts the signal when it loses it. The turn's fence goes to the saver with every write, so a driver whose lease was taken over
 * cannot move the thread. A run starts inside the wake that opened it; a person's decision and a re-drive are WRITTEN AS WAKES of the
 * same scope (`ThreadResumeRequestsService.resume`, admitted from the stores in any app; `redrive` here), so they queue behind whatever
 * holds the lease and survive a restart. A wake that is tried again
 * (its drive threw, its process died) continues the thread from its last checkpoint instead of starting it twice.
 *
 * PINNED VERSION. A thread is driven on the graph of the version its run started on (`ThreadGraphsService`), never on the version
 * that is active now.
 *
 * ENGINE. Which workflows start on a thread is the app's flag (`AgentThreadsOptions.workflows`); a run stays on the engine it started
 * on: a wake tried again reads its run's engine, and a run of the old engine is refused here.
 */
export class ThreadRunsService implements FlowThreads, OnModuleInit {
    /** Who is told when a drive leaves a thread stopped. */
    private readonly stoppedListeners: Array<ThreadStoppedListener> = []

    /** Who is told after each drive that left a thread stopped or ended. */
    private readonly settledListeners: Array<ThreadSettledListener> = []

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly flows: AgentGraphFlowRunsService,
        private readonly graphs: ThreadGraphsService,
        private readonly runs: AgentRunsService,
        private readonly view: AgentRunsViewService,
        private readonly wakes: AgentWakeService,
        private readonly stops: RunStopsService,
        private readonly projection: ThreadProjectionService,
        @Optional() @InjectGraphThreads() private readonly port?: GraphThreads,
        @Optional() private readonly workflows?: AgentWorkflowRunsService,
        @Optional() private readonly wakeReader?: AgentWorkReadService,
    ) {}

    /**
     * Registers with the flow once the app has started. An app that composed the thread runs but no threads port does not start: every
     * workflow's runs start on a thread, so it would open runs no engine drives.
     */
    onModuleInit(): void {
        if (this.port === undefined) throw new AgentThreadsError({ code: AgentThreadsErrorCode.PortMissing })
        this.flows.setThreads(this)
    }

    /** Adds a listener told each time a drive leaves a thread stopped at a step (the deadlines of the stops register here). */
    whenStopped(listener: ThreadStoppedListener): void {
        this.stoppedListeners.push(listener)
    }

    /** Adds a listener told after every drive that left a thread stopped or ended (the subject holds release the wakes held behind a finished run here). */
    whenSettled(listener: ThreadSettledListener): void {
        this.settledListeners.push(listener)
    }

    /** True for a wake this capability wrote: a decision for a stopped thread, or a re-drive. */
    owns(turn: AgentTurnView): boolean {
        const event = turn.context.eventName
        const source = turn.source === THREAD_WAKE_SOURCE || turn.source === LEGACY_THREAD_WAKE_SOURCE
        return (
            source &&
            (event === THREAD_RESUME_EVENT ||
                event === THREAD_DRIVE_EVENT ||
                event === THREAD_ROUND_EVENT ||
                event === THREAD_WAIT_EVENT)
        )
    }

    /** Marks the run as a thread's in the transaction that opened it; a run that cannot be marked starts no thread. */
    async opened(tx: EntityManager, workspaceId: string, runId: string): Promise<void> {
        const outcome = await this.projection.runStarted({ workspaceId, runId }, tx)
        if (outcome !== "written" && outcome !== "kept")
            throw new AgentThreadsError({ code: AgentThreadsErrorCode.RunUnmarked, params: { runId } })
    }

    /**
     * Starts the thread of a run under the lease of the wake that opened it and runs it until it ends or stops. When the wake is tried
     * again the thread already has a checkpoint: it is continued on the version it is pinned to, and its trigger is not fed twice.
     */
    async started(run: FlowThreadRun, signal: AbortSignal): Promise<AgentHandlerEnding> {
        const { turn } = run
        const ref: ThreadRef = { workspaceId: turn.workspaceId, runId: run.runId }
        const routed = { versionId: run.versionId, flow: run.flow, number: run.workflowVersion }
        const driven: DrivenRun = { agentId: turn.agentId, namespace: run.namespace, workflowId: run.workflowId }
        return this.drivenUnder({ turn, signal, ref, run: driven, decision: null }, async (port, lease) => {
            const seen = await port.stateOf(ref)
            if (seen === null) {
                const graph = await this.graphs.routed(ref, routed)
                return port.start(ref, graph, { trigger: plainOf(run.trigger) }, lease)
            }
            const pinned =
                seen.version === run.versionId
                    ? await this.graphs.routed(ref, routed)
                    : await this.graphs.pinned(ref, turn.agentId, seen.version)
            return port.drive(ref, pinned, lease)
        })
    }

    /**
     * Runs a wake this capability wrote, under its lease. A person's decision is RECORDED by the resume requests
     * (`ThreadResumeRequestsService`, admitted from the stores in any app) as a resume wake; here, in the app that holds the threads, it
     * is handed to the thread only while the stop it answers stands as it did when the decision was recorded (the checkpoint waits on
     * that step, and the stop holds as many answers): the SECOND guard. A wake that is tried again after its decision was applied
     * continues the thread instead and never answers a later stop; a decision that no longer stands and was never applied is STALE: one
     * log line names it, and the thread is driven as it stands (a stopped thread runs nothing).
     */
    async woken(turn: AgentTurnView, signal: AbortSignal): Promise<AgentHandlerEnding> {
        const runId = turn.context.subjectId
        if (runId === undefined) return this.skipped(turn, "thread_wake_unreadable")
        const ref: ThreadRef = { workspaceId: turn.workspaceId, runId }
        const run = await this.runs.runOf(turn.workspaceId, runId)
        if (run?.agentId !== turn.agentId) return this.skipped(turn, "thread_run_missing")
        if ((await this.engineOf(turn.workspaceId, run.agentId, runId)) !== "langgraph")
            return this.skipped(turn, "thread_run_legacy")
        const resumes = turn.context.eventName === THREAD_RESUME_EVENT
        const carry = resumes ? resumeCarryOf(turn.context.tagContext) : null
        if (resumes && carry === null) return this.skipped(turn, "thread_decision_unreadable")
        const seen = await this.portOf().stateOf(ref)
        if (seen === null) return this.skipped(turn, "thread_absent")
        const graph = await this.graphs.pinned(ref, run.agentId, seen.version)
        const workflowKey = (await this.workflows?.workflowKeyOfRun(turn.workspaceId, runId)) ?? undefined
        const [pin] = (await this.workflows?.pinsOf(turn.workspaceId, [runId])) ?? []
        const driven: DrivenRun = {
            agentId: run.agentId,
            namespace: namespaceOf(this.graphs.moduleKeyOf(seen.version) ?? "", workflowKey),
            workflowId: pin?.workflowId ?? null,
        }
        const decision = carry !== null && (await this.stands(ref, seen, carry)) ? carry.decision : null
        if (carry !== null && decision === null) await this.staleTold(ref, carry)
        if (turn.context.eventName === THREAD_ROUND_EVENT) return this.roundWoken({ turn, signal, ref, run: driven, decision: null }, seen, graph)
        if (turn.context.eventName === THREAD_WAIT_EVENT) return this.waitWoken({ turn, signal, ref, run: driven, decision: null }, seen, graph)
        return this.drivenUnder({ turn, signal, ref, run: driven, decision }, (port, lease) =>
            decision === null ? port.drive(ref, graph, lease) : port.resume(ref, graph, decision, lease),
        )
    }

    /**
     * The next round of a `loop({ until, every })` is due: a wake of the run's scope that resumes the thread parked on exactly that park
     * (`UntilRoundWakesService` asks, when the park's timer came). Written once per park; refused, with nothing written, for a thread
     * that waits on no park or on another one. It runs nothing here: the drain resumes the thread under the lease.
     */
    async roundDue(ref: ThreadRef, park: UntilPark, tx?: EntityManager): Promise<ThreadWakeAdmission> {
        const run = await this.admissible(ref)
        if (run.kind === "refused") return this.refused(ref, run.code)
        const parked = run.seen.status === "stopped" ? parkOfQuestion(run.seen.stop?.question) : null
        if (parked?.parkKey !== park.parkKey) return this.refused(ref, "thread_not_stopped")
        const draft: WakeDraft = {
            eventKey: `thread:${ref.runId}:round:${park.parkKey}`,
            eventName: THREAD_ROUND_EVENT,
            carry: JSON.stringify({ parkKey: park.parkKey, round: park.round }),
            actorMemberId: null,
        }
        return this.admit(ref, run, draft, tx)
    }

    /**
     * Runs a round wake under its lease: the thread still parked on the park the wake carries is resumed with the round's decision (the
     * loop node runs again from its first line and starts the round); any other thread is driven as it stands (a stopped one runs nothing).
     */
    private roundWoken(drive: Drive, seen: ThreadView, graph: ThreadGraph): Promise<AgentHandlerEnding> {
        const carry = roundCarryOf(drive.turn.context.tagContext)
        const parked = seen.status === "stopped" ? parkOfQuestion(seen.stop?.question) : null
        const stands = carry !== null && parked !== null && parked.parkKey === carry.parkKey
        const decision: UntilRoundDecision | null =
            stands && carry !== null
                ? { kind: UNTIL_PARK_KIND, parkKey: carry.parkKey, round: carry.round, at: this.clock.now().toISOString() }
                : null
        return this.drivenUnder(drive, (port, lease) =>
            decision === null ? port.drive(drive.ref, graph, lease) : port.resume(drive.ref, graph, decision, lease),
        )
    }

    /**
     * What came to a thread parked on a `wait`: one of its triggers' events (`wakeId`: the event's own wake) or its timeout. ONE wake of
     * the run's scope per park (the once-key `waitOnceKeyOf`), so of an event and the deadline, of two events, the first written is the
     * one applied; `fresh: false` for every later comer, whose carry is the first one's (`sameWaitKept` says whether it was this one).
     * Refused, with nothing written, for a thread that waits on no park or on another one. It runs nothing here.
     */
    async waitAnswered(ref: ThreadRef, parkKey: string, came: WaitCame, wakeId: string | null, tx?: EntityManager): Promise<ThreadWakeAdmission> {
        const run = await this.admissible(ref)
        if (run.kind === "refused") return this.refused(ref, run.code)
        const parked = run.seen.status === "stopped" ? parkOfWaitQuestion(run.seen.stop?.question) : null
        if (parked?.parkKey !== parkKey) return this.refused(ref, "thread_not_stopped")
        const carry: WaitCarry = { parkKey, came, wakeId }
        return this.admit(
            ref,
            run,
            { eventKey: waitOnceKeyOf(ref.runId, parkKey), eventName: THREAD_WAIT_EVENT, carry: JSON.stringify(carry), actorMemberId: null },
            tx,
        )
    }

    /**
     * Whether the wake kept for a park carries this very event: the wake of `wakeId` (an event's wake tried again finds it took the park
     * itself), or the same event through another agent's wake of it (`eventId`: one event is delivered once per agent it reaches, and the
     * first of them that the park admitted took it for all). `agentId` is the RUN's agent, whose wake the park's is.
     */
    async sameWaitKept(ref: ThreadRef, agentId: string, parkKey: string, wakeId: string, eventId: string | null = null): Promise<boolean> {
        if (this.wakeReader === undefined) return false
        const kept = await this.wakeReader.wakeContextOf(ref.workspaceId, agentId, THREAD_WAIT_EVENT_SOURCE, waitOnceKeyOf(ref.runId, parkKey))
        const carry = waitCarryOf(kept?.tagContext)
        if (carry === null) return false
        if (carry.wakeId === wakeId) return true
        if (eventId === null || eventId === "" || "timeout" in carry.came) return false
        return carry.came.event.eventId === eventId
    }

    /**
     * Runs a wait wake under its lease: the thread still parked on the park the wake carries is resumed with what came (the wait node runs
     * again from its first line and answers it); any other thread is driven as it stands (a stopped one runs nothing).
     */
    private waitWoken(drive: Drive, seen: ThreadView, graph: ThreadGraph): Promise<AgentHandlerEnding> {
        const carry = waitCarryOf(drive.turn.context.tagContext)
        const parked = seen.status === "stopped" ? parkOfWaitQuestion(seen.stop?.question) : null
        const decision: WaitDecision | null =
            carry !== null && parked !== null && parked.parkKey === carry.parkKey
                ? { kind: WAIT_PARK_KIND, parkKey: carry.parkKey, came: carry.came, at: this.clock.now().toISOString() }
                : null
        return this.drivenUnder(drive, (port, lease) =>
            decision === null ? port.drive(drive.ref, graph, lease) : port.resume(drive.ref, graph, decision, lease),
        )
    }

    /**
     * Asks for a thread whose drive was cut (a crash past its wake's tries) to be continued: a wake of the run's scope, once per
     * `key`. A stopped thread is not moved by it (only a decision moves a stop); an ended one is refused.
     */
    async redrive(ref: ThreadRef, key: string, tx?: EntityManager): Promise<ThreadWakeAdmission> {
        const run = await this.admissible(ref)
        if (run.kind === "refused") return this.refused(ref, run.code)
        if (run.seen.status === "ended") return this.refused(ref, "thread_ended")
        const draft: WakeDraft = {
            eventKey: `thread:${ref.runId}:drive:${key}`,
            eventName: THREAD_DRIVE_EVENT,
            carry: null,
            actorMemberId: null,
        }
        return this.admit(ref, run, draft, tx)
    }

    /** The run of a wake to write: it is a thread's, it has a checkpoint and it names its scope. */
    private async admissible(ref: ThreadRef): Promise<AdmissibleRun | ThreadWakeRefused> {
        const run = await this.runs.runOf(ref.workspaceId, ref.runId)
        if (run === null) return { kind: "refused", code: "run_missing" }
        if (this.port === undefined || (await this.engineOf(ref.workspaceId, run.agentId, ref.runId)) !== "langgraph")
            return { kind: "refused", code: "run_not_thread" }
        const seen = await this.port.stateOf(ref)
        if (seen === null) return { kind: "refused", code: "thread_absent" }
        const scopeKey: unknown = run.context[THREAD_SCOPE_MEMBER]
        if (typeof scopeKey !== "string" || scopeKey === "") return { kind: "refused", code: "scope_unknown" }
        return { kind: "ok", agentId: run.agentId, scopeKey, seen }
    }

    private async admit(
        ref: ThreadRef,
        run: AdmissibleRun,
        draft: WakeDraft,
        tx: EntityManager | undefined,
    ): Promise<ThreadWakeAdmission> {
        const write = (manager: EntityManager) =>
            this.wakes.write(manager, {
                workspaceId: ref.workspaceId,
                agentId: run.agentId,
                source: THREAD_WAKE_SOURCE,
                eventKey: draft.eventKey,
                scopeKey: run.scopeKey,
                context: {
                    eventName: draft.eventName,
                    subjectId: ref.runId,
                    ...(draft.carry === null ? {} : { tagContext: draft.carry }),
                },
                actorMemberId: draft.actorMemberId,
            })
        const id = tx === undefined ? await this.entityManager.transaction(write) : await write(tx)
        this.logger.info(AgentThreadsLogEvent.WakeAdmitted, { runId: ref.runId, event: draft.eventName, fresh: id !== null })
        return { kind: "admitted", fresh: id !== null }
    }

    private refused(ref: ThreadRef, code: ThreadWakeRefusal): ThreadWakeAdmission {
        this.logger.warn(AgentThreadsLogEvent.WakeRefused, { runId: ref.runId, code })
        return { kind: "refused", code }
    }

    private skipped(turn: AgentTurnView, code: string): AgentHandlerEnding {
        this.logger.warn(AgentThreadsLogEvent.WakeSkipped, { agentId: turn.agentId, wakeId: turn.wakeId, code })
        return { status: "skipped", reason: code, outcome: null }
    }

    /**
     * A decision that does not stand: applied already (its answer is among the stop's answers: this wake was tried again), or STALE (the
     * stop resolved, or the thread moved on, before it was applied): only a stale one is told, once per run of its wake.
     */
    private async staleTold(ref: ThreadRef, carry: ResumeCarry): Promise<void> {
        const stop = await this.stops.stopOf(ref, carry.stepKey)
        if (stop !== null && answerIndexOf(stop.answers, stopAnswerOf(carry.decision)) >= 0) return
        this.logger.warn(AgentThreadsLogEvent.DecisionStale, {
            runId: ref.runId,
            stepKey: carry.stepKey,
            kind: carry.decision.kind,
            by: carry.decision.kind === "timeout" ? "deadline" : carry.decision.by,
        })
    }

    /** Whether the stop a decision was admitted against still stands as it did: the thread waits on that step, and no answer was added. */
    private async stands(ref: ThreadRef, seen: ThreadView, carry: ResumeCarry): Promise<boolean> {
        if (stoppedStepOf(seen) !== carry.stepKey) return false
        const stop = await this.stops.stopOf(ref, carry.stepKey)
        return stop?.state === "open" && stop.answers.length === carry.answered
    }

    /**
     * One drive of a thread under a turn's lease. Nothing runs when the lease is already lost or this process already drives the
     * thread (`AGENT_THREADS_BUSY`: the wake is tried again). The port is handed the turn's fence and the signal the drain aborts when
     * the lease goes. A write the saver refuses as fenced, and any other throw, leave the thread at its last checkpoint and reject
     * the turn with no row written here: the wake is tried again and continues the thread.
     */
    private async drivenUnder(
        drive: Drive,
        run: (port: GraphThreads, lease: ThreadLease) => Promise<ThreadOutcome>,
    ): Promise<AgentHandlerEnding> {
        const { turn, signal, ref } = drive
        const port = this.portOf()
        if (signal.aborted)
            throw new AgentThreadsError({ code: AgentThreadsErrorCode.LeaseLost, params: { runId: ref.runId } })
        if (this.graphs.isDriving(ref.runId)) throw this.busy(ref)
        try {
            this.logger.info(AgentThreadsLogEvent.ThreadDriven, { runId: ref.runId, wakeId: turn.wakeId, fence: turn.fence })
            const lease = { fence: turn.fence, signal }
            const driven = async (): Promise<ThreadOutcome> => {
                try {
                    return await run(port, lease)
                } catch (cause) {
                    // A visit the checkpoint refused as too large would be refused again on every drive: the step is marked and the
                    // thread driven once more, so that visit becomes an engine stop for the founder (one stop, one card, run waiting).
                    const again = await this.oversizedAgain(port, drive, cause)
                    if (again === null) throw cause
                    return port.drive(ref, again, lease)
                }
            }
            // Every model call of the drive is booked to the run (`ai_usage_events.run_id`) through the run scope: the run page's AI calls
            // and the cost per run read it (D-P10-7).
            const outcome = await withRunScope(ref.runId, () => this.graphs.driving(ref.runId, drive.run, driven))
            return await this.settled(drive, outcome)
        } catch (cause) {
            if (isFenced(cause)) this.logger.warn(AgentThreadsLogEvent.ThreadFenced, { runId: ref.runId, fence: turn.fence })
            throw cause
        }
    }

    /** The graph to drive again after a too-large refusal, with the refused step marked; null for any other throw. */
    private async oversizedAgain(port: GraphThreads, drive: Drive, cause: unknown): Promise<ThreadGraph | null> {
        if (!(cause instanceof LanggraphError) || cause.code !== LanggraphErrorCode.CheckpointTooLarge) return null
        const seen = await port.stateOf(drive.ref)
        const [stepKey] = seen?.next ?? []
        if (seen === null || stepKey === undefined || drive.signal.aborted) return null
        const params = cause.params ?? {}
        this.graphs.oversize(drive.ref.runId, stepKey, Number(params["bytes"] ?? 0), Number(params["limit"] ?? 0))
        return this.graphs.pinned(drive.ref, drive.run.agentId, seen.version)
    }

    /** What a drive came to, as the end of its wake: a stop and an end are both the wake's work done; busy and absent reject it. */
    private async settled(drive: Drive, outcome: ThreadOutcome): Promise<AgentHandlerEnding> {
        const { ref } = drive
        if (outcome.status === "busy") throw this.busy(ref)
        if (outcome.status === "absent")
            throw new AgentThreadsError({ code: AgentThreadsErrorCode.ThreadAbsent, params: { runId: ref.runId } })
        if (outcome.status === "stopped") {
            this.logger.info(AgentThreadsLogEvent.ThreadStopped, { runId: ref.runId, node: outcome.stop.node })
            await this.toldStopped(ref, outcome.stop.question)
            await this.toldSettled(ref)
            return doneOf(ref.runId)
        }
        await this.ended(drive)
        await this.toldSettled(ref)
        return doneOf(ref.runId)
    }

    /** The end hook of a thread. A thread that reached its end closes its run as done; a thread a founder skipped was closed by the gate. */
    private async ended(drive: Drive): Promise<void> {
        const { ref } = drive
        const skippedByFounder = endsTheRun(drive.decision)
        this.logger.info(AgentThreadsLogEvent.ThreadEnded, { runId: ref.runId, skipped: skippedByFounder })
        if (skippedByFounder) return
        const wrote = await this.projection.runEnded(ref, { outcome: "done", code: null, by: null, at: this.clock.now() })
        if (wrote === "refused") this.logger.warn(AgentThreadsLogEvent.ProjectionRefused, { runId: ref.runId })
    }

    /** Tells the listeners which step the thread stopped at; a listener that fails is logged (the sweep arms what it missed). */
    private async toldStopped(ref: ThreadRef, question: unknown): Promise<void> {
        const stepKey = isRecord(question) && typeof question.stepKey === "string" ? question.stepKey : null
        if (stepKey === null) return
        for (const listener of this.stoppedListeners) {
            try {
                await listener(ref, stepKey)
            } catch (cause) {
                this.logger.error(AgentThreadsLogEvent.StopListenerFailed, cause, { runId: ref.runId, stepKey })
            }
        }
    }

    /** Tells the settled listeners; a listener that fails is logged (each has its own lazy backstop). */
    private async toldSettled(ref: ThreadRef): Promise<void> {
        for (const listener of this.settledListeners) {
            try {
                await listener(ref)
            } catch (cause) {
                this.logger.error(AgentThreadsLogEvent.StopListenerFailed, cause, { runId: ref.runId })
            }
        }
    }

    private busy(ref: ThreadRef): AgentThreadsError {
        this.logger.warn(AgentThreadsLogEvent.ThreadBusy, { runId: ref.runId })
        return new AgentThreadsError({ code: AgentThreadsErrorCode.Busy, params: { runId: ref.runId } })
    }

    private portOf(): GraphThreads {
        if (this.port === undefined) throw new AgentThreadsError({ code: AgentThreadsErrorCode.PortMissing })
        return this.port
    }

    /** The engine of a run: `legacy` for a run that names none, or that is not this agent's. */
    private async engineOf(workspaceId: string, agentId: string, runId: string): Promise<"legacy" | "langgraph"> {
        return (await this.view.detail(workspaceId, agentId, runId))?.engine ?? "legacy"
    }
}
