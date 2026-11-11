import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { AgentRunCancelService, AgentRunsService, AgentRunsViewService, type OwnerCancelAnswer } from "@modules/domain/agent-runs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { ThreadRunsService, type ThreadWakeRefusal } from "../thread-runs.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import { RunStopsService } from "./run-stops.service"
import type { OptionalRunStop, RunStop, StopDecision } from "./run-stop.contracts"
import { stopDecisionOf } from "./stop-gate.policy"

/** What a person may do with a stop: give their words, or press one of the card's three buttons. */
export const STOP_ACTIONS = ["answer", "retry", "take_over", "skip"] as const

/** One of the four. */
export type StopAction = (typeof STOP_ACTIONS)[number]

/** A person's decision on the stop of a run, as a page, the card or a reply in the team chat sends it. */
export interface StopAsk {
    /** The workspace the caller names. */
    readonly workspaceId: string
    /** The run (the thread). */
    readonly runId: string
    /** The step whose stop is answered; absent answers the run's open stop. */
    readonly stepKey?: string | null | undefined
    /** `answer`, `retry`, `take_over` or `skip`. */
    readonly action: string
    /** The founder's words, for `answer`. */
    readonly text?: string | null | undefined
    /** When the person decided, ISO (a chat reply's own time); absent is now. */
    readonly at?: string | null | undefined
}

/** Who decided: their member id (kept on the stop and the wake) and their name (who holds the conversation after a take-over). */
export interface StopActor {
    /** The member id. */
    readonly memberId: string
    /** The name people see. */
    readonly name: string
}

/**
 * How a decision on a stop ended. `admitted`: a wake of the run carries it, the thread moves under its lease. `already_admitted`: a
 * decision for this stop is already queued and not yet applied (the same one again). `already_answered`: someone already answered this
 * stop with another decision, which is the one applied; this one is not kept. `stop_closed`: the stop was
 * resolved; nothing moved and nothing will. `step_running`: the stop is open but its step runs again right now (after an earlier
 * answer); a decision is taken once the thread waits again. `not_stopped`: the run waits for no person. `not_thread`: a run of the old
 * engine (its own doors answer it). `not_found`: no such run. `invalid`: no such action, or an answer with no words.
 */
export type StopDoorOutcome =
    | "admitted"
    | "already_admitted"
    | "already_answered"
    | "stop_closed"
    | "step_running"
    | "not_stopped"
    | "not_thread"
    | "not_found"
    | "invalid"

/** What the door answers: how it ended and the step whose stop it was, when one was found. */
export interface StopDoorAnswer {
    /** How it ended. */
    readonly outcome: StopDoorOutcome
    /** The step of the stop, or null when none was found. */
    readonly stepKey: string | null
}

const actionOf = (value: string): StopAction | null => STOP_ACTIONS.find((one) => one === value) ?? null

/** The decision a person's action makes, or null for an answer with no words (the shape the stops take, judged by the gate's own policy). */
export const stopDecisionOfAsk = (action: StopAction, by: string, at: string, text: string | null): StopDecision | null =>
    stopDecisionOf(action === "answer" ? { kind: action, text: text ?? "", by, at } : { kind: action, by, at })

/**
 * The stop a decision is about: the stop of the named step, else the run's open stop that stopped last, else the one resolved last (so a
 * late decision is told the stop is closed). Null when the run never stopped.
 */
export const targetStopOf = (stops: ReadonlyArray<RunStop>, stepKey: string | null): OptionalRunStop => {
    if (stepKey !== null) return stops.find((stop) => stop.stepKey === stepKey) ?? null
    const open = stops.filter((stop) => stop.state === "open").toSorted((a, b) => b.stoppedAt.localeCompare(a.stoppedAt))
    if (open.length > 0) return open[0] ?? null
    return stops.toSorted((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "")).at(0) ?? null
}

/** A cancel of a thread run, answered by its stop's `skip`: the run ends as skipped once the thread applies it; effects are kept. */
export const cancelOfSkip = (outcome: StopDoorOutcome): OwnerCancelAnswer => {
    if (outcome === "admitted" || outcome === "already_admitted") return { kind: "cancelled", note: "effects_kept" }
    return { kind: outcome === "not_found" ? "not_found" : "not_cancellable", note: null }
}

/** An owner's or manager's request to stop a run, as the owner door of the runs takes it. */
type OwnerCancelRequest = Parameters<AgentRunCancelService["cancel"]>[0]

/** What a refusal of the thread runs means for the person, given the stop as it stands after it. */
const refusedOutcomeOf = (code: ThreadWakeRefusal, after: OptionalRunStop): StopDoorOutcome => {
    if (code === "decision_invalid") return "invalid"
    if (code === "already_answered") return "already_answered"
    if (code === "run_missing") return "not_found"
    if (code === "run_not_thread") return "not_thread"
    if (after?.state === "resolved") return "stop_closed"
    if (code === "thread_not_stopped" && after?.state === "open") return "step_running"
    return "not_stopped"
}

@Injectable()
/**
 * The people's door to the stop of a thread run: the founder's words (a reply to the card on /chat, the card's box) and the card's three
 * buttons become the typed decision of the stop and go to `ThreadRunsService.resume`, which writes a wake of the run's own scope; nothing
 * runs here. Only an owner or a manager of the workspace may decide, as for the freezes. A stop is one record per run and step: a
 * decision for a stop already resolved is refused with `stop_closed` and never resumes anything. A take-over also hands the run's
 * conversation to the person by name, so the AI stays quiet in it while they hold it. The door carries; the step decides what the words
 * mean. It registers with the runs' cancel door at start, so the run page's Cancel of a thread run is its stop's `skip`. A decision on a
 * stop already resolved still withdraws the approval item that stop left open (a stop closed before items were withdrawn).
 */
export class StopDoorService implements OnModuleInit {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly access: AgentWorkAccessService,
        private readonly members: WorkspaceMembersService,
        private readonly runs: AgentRunsService,
        private readonly view: AgentRunsViewService,
        private readonly records: RunStopRecordsService,
        private readonly threads: ThreadRunsService,
        @Optional() private readonly conversations?: ChatConversationsService,
        @Optional() private readonly cancels?: AgentRunCancelService,
        @Optional() private readonly stops?: RunStopsService,
    ) {}

    /** A person's decision: refused (typed) for anyone but an owner or a manager of the workspace, else applied as theirs. */
    async decide(principalId: string, ask: StopAsk): Promise<StopDoorAnswer> {
        const memberId = await this.access.manager(principalId, ask.workspaceId)
        const name =
            ask.action === "take_over" ? (await this.members.require(principalId, ask.workspaceId)).displayName : memberId
        return this.apply({ memberId, name }, ask)
    }

    /** Registers with the runs' cancel door once the app has started. */
    onModuleInit(): void {
        this.cancels?.setThreadStops(this)
    }

    /** The run page's Cancel of a thread run (the cancel door hands it here): the stop's `skip`, decided as the same person. */
    async skipRun(request: OwnerCancelRequest): Promise<OwnerCancelAnswer> {
        const skipped = await this.decide(request.principalId, {
            workspaceId: request.workspaceId,
            runId: request.runId,
            action: "skip",
        })
        return cancelOfSkip(skipped.outcome)
    }

    /** True when the run is a thread's (`engine = langgraph`): its stops are answered here, never by the old engine's doors. */
    async isThreadRun(workspaceId: string, runId: string): Promise<boolean> {
        return (await this.engineOf(workspaceId, runId)) === "langgraph"
    }

    /** A decision of a person already allowed to decide (the work engine's performer): handed to the thread runs as theirs. */
    async apply(actor: StopActor, ask: StopAsk): Promise<StopDoorAnswer> {
        const action = actionOf(ask.action)
        if (action === null) return { outcome: "invalid", stepKey: null }
        const engine = await this.engineOf(ask.workspaceId, ask.runId)
        if (engine !== "langgraph") return { outcome: engine === null ? "not_found" : "not_thread", stepKey: null }
        const stop = targetStopOf(await this.records.ofRun(ask.workspaceId, ask.runId), ask.stepKey ?? null)
        if (stop === null) return { outcome: "not_stopped", stepKey: null }
        const answer = (outcome: StopDoorOutcome): StopDoorAnswer => ({ outcome, stepKey: stop.stepKey })
        if (stop.state === "resolved") {
            // A stop resolved before its approval item was withdrawn (D-P11-6) still has it open in the owner's inbox: a late decision
            // on that stop withdraws it. Nothing else moves: the stop stays closed.
            await this.stops?.leftoverWithdrawn({ workspaceId: ask.workspaceId, runId: ask.runId }, stop.stepKey, { locale: "vi" })
            return answer("stop_closed")
        }
        const at = ask.at ?? this.clock.now().toISOString()
        const decision = stopDecisionOfAsk(action, actor.memberId, at, ask.text ?? null)
        if (decision === null) return answer("invalid")
        const ref = { workspaceId: ask.workspaceId, runId: ask.runId }
        const admission = await this.threads.resume(ref, decision)
        if (admission.kind === "refused") {
            const after = await this.records.byRunStep(ask.workspaceId, ask.runId, stop.stepKey)
            return answer(refusedOutcomeOf(admission.code, after))
        }
        if (!admission.fresh) return answer("already_admitted")
        if (action === "take_over" && stop.conversationId !== null)
            await this.conversations?.setHolder(ask.workspaceId, stop.conversationId, actor.name)
        return answer("admitted")
    }

    /** The engine of a run of the workspace, or null when the workspace has no such run. */
    private async engineOf(workspaceId: string, runId: string): Promise<"legacy" | "langgraph" | null> {
        const run = await this.runs.runOf(workspaceId, runId)
        if (run === null) return null
        return (await this.view.detail(workspaceId, run.agentId, runId))?.engine ?? "legacy"
    }
}
