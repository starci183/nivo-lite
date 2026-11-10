import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    AgentGraphFlowRunsService,
    AgentWorkflowRunsService,
    THREAD_SCOPE_MEMBER,
    namespaceOf,
} from "@modules/domain/agent-graphs"
import type { FlowThreadRun, FlowThreads, OptionalFlowRunEngine } from "@modules/domain/agent-graphs"
import { AgentRunsService, AgentRunsViewService } from "@modules/domain/agent-runs"
import { AgentTagService, AgentWakeService, AgentWorkReadService, ENGINE_THREAD_SOURCE } from "@modules/domain/agent-work"
import type { AgentHandlerEnding, AgentTurnView } from "@modules/domain/agent-work"
import { InjectGraphThreads, LanggraphError, LanggraphErrorCode } from "@modules/integrations/langgraph"
import type {
    GraphThreads,
    ThreadGraph,
    ThreadLease,
    ThreadOutcome,
    ThreadRef,
    ThreadState,
    ThreadView,
} from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { InjectAgentThreadsOptions } from "./agent-threads.decorators"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import type { AgentThreadsOptions } from "./agent-threads.options"
import { AgentThreadsError, AgentThreadsErrorCode } from "./errors/agent-threads.error"
import { RunStopsService } from "./stops/run-stops.service"
import { stopDecisionOf } from "./stops/stop-gate.policy"
import type { StopDecision } from "./stops/run-stop.contracts"
import { ThreadGraphsService } from "./thread-graphs.service"
import type { DrivenRun } from "./thread-graphs.service"
import { ThreadProjectionService } from "./thread-projection.service"

/**
 * The source of the wakes a thread writes for itself: the work core's `thread` source (a person waits on a decision, so it is not
 * background work and is never skipped by the daily cap; it is restored when the agent's work is switched back on; three tries). The
 * wake names the lock scope itself, so it takes the lease of the run's own scope, never the agent's.
 */
export const THREAD_WAKE_SOURCE = ENGINE_THREAD_SOURCE

/** The source thread wakes were written under before they had their own (restart TWELVE): such a wake still in the table is still run. */
const LEGACY_THREAD_WAKE_SOURCE = "internal"

/** Told when a drive left a thread stopped for a person at a step (the deadlines arm here); it never fails the wake. */
export type ThreadStoppedListener = (ref: ThreadRef, stepKey: string) => Promise<void>

/**
 * Told after every drive that settled a thread (it stopped, or it ended): a capability above the threads (the lead freezes, which
 * release a customer's held wakes once the stop closed) registers here, so the threads import nothing of it. It never fails the wake.
 */
export type ThreadSettledListener = (ref: ThreadRef) => Promise<void>

/** The event of a wake that carries a person's decision to a stopped thread. */
export const THREAD_RESUME_EVENT = "engine.thread.resume"

/** The event of a wake that continues a thread whose drive was cut. */
export const THREAD_DRIVE_EVENT = "engine.thread.drive"

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

/** What a resume wake carries beside the run: the decision, and the stop it answers as it stood when the decision was admitted. */
interface ResumeCarry {
    readonly decision: StopDecision
    /** The step whose stop it answers. */
    readonly stepKey: string
    /** How many answers that stop had: the decision is applied only while it still has that many, so never twice. */
    readonly answered: number
}

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

/** What a resume wake carries, read back from its context; null when it is not what `resume` wrote. */
const carryOf = (text: string | undefined): ResumeCarry | null => {
    const read = text === undefined ? null : parseJsonText(text)
    if (read === null || !read.ok || !isRecord(read.value)) return null
    const decision = stopDecisionOf(read.value.decision)
    const { stepKey, answered } = read.value
    if (decision === null || typeof stepKey !== "string" || typeof answered !== "number") return null
    return { decision, stepKey, answered }
}

/** Whether two carried decisions are the same decision for the same stop state (their JSON read back, so key order cannot differ). */
const sameCarry = (kept: string | undefined, carry: string | null): boolean => {
    const left = carryOf(kept)
    const right = carry === null ? null : carryOf(carry)
    return left !== null && right !== null && JSON.stringify(left) === JSON.stringify(right)
}

/** A member id as the wake's actor column (a uuid) takes it. */
const MEMBER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/**
 * Who a decision names as the wake's actor: a member id only. Anything else (`deadline`, an engine actor, an approver the log could not
 * name) stays in the wake's payload, where the decision keeps its `by`, and the actor column is left empty.
 */
const actorOf = (decision: StopDecision): string | null =>
    decision.kind !== "timeout" && MEMBER_ID.test(decision.by) ? decision.by : null

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
 * same scope (`resume`, `redrive`), so they queue behind whatever holds the lease and survive a restart. A wake that is tried again
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
        @InjectAgentThreadsOptions() private readonly options: AgentThreadsOptions,
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
        @Optional() private readonly tags?: AgentTagService,
        @Optional() private readonly wakeReader?: AgentWorkReadService,
    ) {}

    /**
     * Registers with the flow once the app has started. An app whose flag names a workflow but that composed no threads port does not
     * start: it would open runs no engine drives.
     */
    onModuleInit(): void {
        if (this.options.workflows.length > 0 && this.port === undefined)
            throw new AgentThreadsError({ code: AgentThreadsErrorCode.PortMissing })
        if (this.port !== undefined) this.flows.setThreads(this)
    }

    /** Adds a listener told each time a drive leaves a thread stopped at a step (the deadlines of the stops register here). */
    whenStopped(listener: ThreadStoppedListener): void {
        this.stoppedListeners.push(listener)
    }

    /** Adds a listener told after every drive that left a thread stopped or ended (the lead freezes release their holds here). */
    whenSettled(listener: ThreadSettledListener): void {
        this.settledListeners.push(listener)
    }

    /** True when a new run of the workflow starts on a thread: the flag names it. */
    engages(namespace: string): boolean {
        return this.options.workflows.includes(namespace)
    }

    /** True for a wake this capability wrote: a decision for a stopped thread, or a re-drive. */
    owns(turn: AgentTurnView): boolean {
        const event = turn.context.eventName
        const source = turn.source === THREAD_WAKE_SOURCE || turn.source === LEGACY_THREAD_WAKE_SOURCE
        return source && (event === THREAD_RESUME_EVENT || event === THREAD_DRIVE_EVENT)
    }

    /** The engine the run of a wake started on, or null when the wake opened no run yet. */
    async engineOfWake(turn: AgentTurnView): Promise<OptionalFlowRunEngine> {
        const runId = await this.runs.runIdOfWake(turn.workspaceId, turn.wakeId)
        return runId === null ? null : this.engineOf(turn.workspaceId, turn.agentId, runId)
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
     * Runs a wake this capability wrote, under its lease. A decision is handed to the thread only while the stop it answers stands as
     * it did when the decision was admitted (same step, same number of answers): a wake that is tried again after its decision was
     * applied, and a second decision for the same stop, continue the thread instead and never answer a later stop.
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
        const carry = resumes ? carryOf(turn.context.tagContext) : null
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
        return this.drivenUnder({ turn, signal, ref, run: driven, decision }, (port, lease) =>
            decision === null ? port.drive(ref, graph, lease) : port.resume(ref, graph, decision, lease),
        )
    }

    /**
     * Hands a stopped thread a person's decision: `{ kind: "answer", text, by, at }`, a button (`retry`, `take_over`, `skip`) or a
     * deadline (`timeout`). It writes a wake of the run's own scope and runs nothing here: the drain applies the decision under the
     * lease, so two decisions, or a decision and a customer's new message, never drive one thread at once. Refused, with nothing
     * written, for a value that is no decision, a run of the old engine and a thread that does not wait for a person.
     *
     * ONE DECISION PER STOP STATE. The wake is keyed by the stop and its count of answers, so of two decisions on the same stop the
     * first written wins (the database's unique key serialises them) and is the one applied under the lease. The same decision handed
     * again is `admitted` with `fresh: false`; a DIFFERENT one is refused `already_answered`, never silently dropped, never applied.
     */
    async resume(ref: ThreadRef, value: unknown, tx?: EntityManager): Promise<ThreadWakeAdmission> {
        const decision = stopDecisionOf(value)
        if (decision === null) return this.refused(ref, "decision_invalid")
        const run = await this.admissible(ref)
        if (run.kind === "refused") return this.refused(ref, run.code)
        const stepKey = stoppedStepOf(run.seen)
        const stop = stepKey === null ? null : await this.stops.stopOf(ref, stepKey)
        if (stepKey === null || stop?.state !== "open") return this.refused(ref, "thread_not_stopped")
        const carry: ResumeCarry = { decision, stepKey, answered: stop.answers.length }
        const draft: WakeDraft = {
            eventKey: `thread:${ref.runId}:${stepKey}:${carry.answered}`,
            eventName: THREAD_RESUME_EVENT,
            carry: JSON.stringify(carry),
            actorMemberId: actorOf(decision),
        }
        const admission = await this.admit(ref, run, draft, tx)
        if (admission.kind !== "admitted" || admission.fresh) return admission
        return (await this.sameDecisionKept(ref, run.agentId, draft)) ? admission : this.refused(ref, "already_answered")
    }

    /**
     * Whether the wake already written for this stop state carries this very decision (read after the unique key settled the race);
     * without the work core's reader (a test world) the earlier wake is taken as this one, as before.
     */
    private async sameDecisionKept(ref: ThreadRef, agentId: string, draft: WakeDraft): Promise<boolean> {
        if (this.wakeReader === undefined) return true
        const kept = await this.wakeReader.wakeContextOf(ref.workspaceId, agentId, THREAD_WAKE_SOURCE, draft.eventKey)
        // A wake of the same key written under the old source before the switch.
        const legacy =
            kept === null
                ? await this.wakeReader.wakeContextOf(ref.workspaceId, agentId, LEGACY_THREAD_WAKE_SOURCE, draft.eventKey)
                : null
        const context = kept ?? legacy
        return context !== null && sameCarry(context.tagContext, draft.carry)
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
            const outcome = await this.graphs.driving(ref.runId, drive.run, async () => {
                try {
                    return await run(port, lease)
                } catch (cause) {
                    // A visit the checkpoint refused as too large would be refused again on every drive: the step is marked and the
                    // thread driven once more, so that visit becomes an engine stop for the founder (one stop, one card, run waiting).
                    const again = await this.oversizedAgain(port, drive, cause)
                    if (again === null) throw cause
                    return port.drive(ref, again, lease)
                }
            })
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
        await this.ended(drive, outcome.state)
        await this.toldSettled(ref)
        return doneOf(ref.runId)
    }

    /**
     * The end hook of a thread. A thread that reached its end closes its run as done (the step that ended the path already gave the
     * right to speak back, or kept it for its workflow). A thread a founder skipped was closed by the gate; no step ended its path,
     * so the right to speak in the run's conversation is given back here (an agent that does not hold it changes nothing).
     */
    private async ended(drive: Drive, state: ThreadState): Promise<void> {
        const { ref } = drive
        const skippedByFounder = drive.decision?.kind === "skip"
        this.logger.info(AgentThreadsLogEvent.ThreadEnded, { runId: ref.runId, skipped: skippedByFounder })
        if (!skippedByFounder) {
            const wrote = await this.projection.runEnded(ref, { outcome: "done", code: null, by: null, at: this.clock.now() })
            if (wrote === "refused") this.logger.warn(AgentThreadsLogEvent.ProjectionRefused, { runId: ref.runId })
            return
        }
        const conversationId: unknown = isRecord(state.trigger) ? state.trigger.conversationId : undefined
        if (typeof conversationId === "string")
            await this.tags?.release(ref.workspaceId, conversationId, drive.run.agentId)
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
