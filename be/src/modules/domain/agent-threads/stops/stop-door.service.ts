import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { AgentRunCancelService, AgentRunsService, AgentRunsViewService, type OwnerCancelAnswer } from "@modules/domain/agent-runs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { CustomerRoutesService } from "@modules/domain/customer-routes/customer-routes.service"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { ThreadResumeRequestsService } from "../thread-resume-requests.service"
import type { ThreadWakeRefusal } from "../thread-runs.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import { RunStopsService } from "./run-stops.service"
import type { OptionalRunStop, RunStop, StopDecision } from "./run-stop.contracts"
import { approvalItemWaitingOf } from "./stop-approval.policy"
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

/** Who decided: their member id (kept on the stop and the wake) and their name (the take-over's person). */
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
 * `approval_pending`: a `retry` or the founder's words (`answer`) on a stop that waits for the owner's verdict on a permission request;
 * nothing moved, the request still waits, and the answer names the door that takes the verdict (`refusal`).
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
    | "approval_pending"

/** The door that takes the owner's verdict on a permission request: the mutation `decideAgentRunStep`, verdict `approve` or `reject`. */
export const APPROVAL_DOOR = "decideAgentRunStep"

/** Why a decision was refused although the stop is open, and where the person's decision belongs. */
export interface StopDoorRefusal {
    /** The stop that waits. */
    readonly stopId: string
    /** The owner's item whose verdict the stop waits for. */
    readonly workItemId: string
    /** The door to use instead. */
    readonly door: typeof APPROVAL_DOOR
    /** The verdicts that door takes for a permission request: approve it, or decline it (the one lawful way to withdraw it). */
    readonly verdicts: readonly ["approve", "reject"]
}

/** What the door answers: how it ended and the step whose stop it was, when one was found. */
export interface StopDoorAnswer {
    /** How it ended. */
    readonly outcome: StopDoorOutcome
    /** The step of the stop, or null when none was found. */
    readonly stepKey: string | null
    /** For `approval_pending`: the stop, its item and the door that takes the verdict; absent for every other outcome. */
    readonly refusal?: StopDoorRefusal | undefined
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
 * buttons become the typed decision of the stop and go to the resume request (`ThreadResumeRequestsService.resume`), which admits it from
 * the stores and records it as a wake of the run's own scope the api's drain applies; nothing runs here, so any app that serves people
 * (the api, the mcp app) runs this same door. Only an owner or a manager of the workspace may decide, as for every decision of a stop. A stop is one record per run and step: a
 * decision for a stop already resolved is refused with `stop_closed` and never resumes anything. After a take-over the run stays waiting with its stop open, so the customer's next lines join that stopped run and the person
 * becomes the holder of the run's route (the staff hold, ruling R43): the customer-send door refuses every AI send to it until "hand back to
 * the agent" or any other decision closes the taken-over stop (the resume door clears the hold then). The engine writes no chat record and asks no plugin. A `retry` or the founder's words on a stop that
 * waits for the owner's verdict on a permission request are REFUSED here, before anything is written (`approval_pending`): either would
 * withdraw the request without a word and run the step into its own refusal; the verdict has one door (approve / decline). A
 * `take_over` of such a stop has ONE meaning: it declines the request, by the person, through the work engine (the card's decline path,
 * noted `declined_by_takeover`), and then takes the stop as on any other; the step is not run again, so the engine sends
 * the customer no line and opens no report stop. The door carries; the step decides what the words
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
        private readonly threads: ThreadResumeRequestsService,
        @Optional() private readonly cancels?: AgentRunCancelService,
        @Optional() private readonly stops?: RunStopsService,
        @Optional() private readonly routes?: CustomerRoutesService,
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
        // A permission request that still waits for its verdict takes neither a retry nor words: nothing is withdrawn, no wake is
        // written, no line is sent, no stop is opened. The person is told which door takes the verdict.
        const waitingItem = approvalItemWaitingOf(stop)
        if (waitingItem !== null && (action === "retry" || action === "answer")) {
            return {
                outcome: "approval_pending",
                stepKey: stop.stepKey,
                refusal: { stopId: stop.id, workItemId: waitingItem, door: APPROVAL_DOOR, verdicts: ["approve", "reject"] },
            }
        }
        const at = ask.at ?? this.clock.now().toISOString()
        const decision = stopDecisionOfAsk(action, actor.memberId, at, ask.text ?? null)
        if (decision === null) return answer("invalid")
        const ref = { workspaceId: ask.workspaceId, runId: ask.runId }
        // Taking over a waiting permission request declines it first, by this person: the take-over below then finds no request to
        // withdraw and keeps the thread at the gate.
        if (waitingItem !== null && action === "take_over")
            await this.stops?.declinedByTakeOver(ref, stop.stepKey, actor, { locale: "vi" })
        const admission = await this.threads.resume({ ...ref, stepKey: stop.stepKey }, decision)
        if (admission.kind === "refused") {
            const after = await this.records.byRunStep(ask.workspaceId, ask.runId, stop.stepKey)
            return answer(refusedOutcomeOf(admission.code, after))
        }
        // The staff hold (ruling R43): a take-over the thread admitted makes the person the holder of the run's route, so the send door
        // refuses every AI send to it until "hand back to the agent" clears it. A run about no route (a bank-fed run) holds nothing.
        if (action === "take_over" && stop.conversationId !== null)
            await this.routes?.hold(ask.workspaceId, stop.conversationId, actor.memberId)
        // Any other decision on a stop a person took over (retry, words, skip) ends that hold: the resume door clears it with the wake
        // (`heldRouteEndedBy`, rulings R51, R52), one rule for every caller.
        if (!admission.fresh) return answer("already_admitted")
        return answer("admitted")
    }

    /** The engine of a run of the workspace, or null when the workspace has no such run. */
    private async engineOf(workspaceId: string, runId: string): Promise<"legacy" | "langgraph" | null> {
        const run = await this.runs.runOf(workspaceId, runId)
        if (run === null) return null
        return (await this.view.detail(workspaceId, run.agentId, runId))?.engine ?? "legacy"
    }
}
