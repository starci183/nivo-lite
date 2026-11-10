import type {
    RunStopAnswer,
    RunStopCustomerLine,
    RunStopDecision,
    RunStopDetail,
    RunStopFact,
    RunStopSuggestion,
} from "@nivo-lite/blocks-core/entities"

/** Why a step stopped: the AI core reported it, the AI itself failed (the engine's static words stand in), or a call waits for approval. */
export type StopKind = "ai_report" | "ai_error" | "approval" | "engine"

/** Where a stop stands. */
export type StopState = "open" | "resolved"

/** One stop as its record keeps it: one per run and step, never per customer. */
export interface RunStop {
    /** The record id. */
    readonly id: string
    /** The record version: the fence of every write. */
    readonly version: string
    /** The run (the thread). */
    readonly runId: string
    /** The step that stopped. */
    readonly stepKey: string
    /** The agent of the run. */
    readonly agentId: string
    /** The workflow the run executes, or null for an agent's own graph. */
    readonly workflowId: string | null
    /** The customer, when the run names one. */
    readonly leadId: string | null
    /** The conversation of the run, when it has one (a bank-fed run has none). */
    readonly conversationId: string | null
    /** Why it stopped. */
    readonly kind: StopKind
    /** Where it stands. */
    readonly state: StopState
    /** The reason, in the AI core's words or the engine's. */
    readonly reason: string
    /** The question for the founder, or null. */
    readonly question: string | null
    /** The suggestions and the engine's facts. */
    readonly detail: RunStopDetail
    /** The team chat message of the stop's card, once posted. */
    readonly cardMessageId: string | null
    /** The lines the stopped step sent customers while the stop was open, oldest first. */
    readonly customerLines: ReadonlyArray<RunStopCustomerLine>
    /** Every answer the stop received, oldest first. */
    readonly answers: ReadonlyArray<RunStopAnswer>
    /** The decision that resolved it, or null while open. */
    readonly decision: RunStopDecision | null
    /** How many times this step of this run stopped. */
    readonly repeats: number
    /** When it last stopped, ISO. */
    readonly stoppedAt: string
    /** When it was resolved, ISO, or null. */
    readonly resolvedAt: string | null
}

/** A stop, or null when there is none. */
export type OptionalRunStop = RunStop | null

/** What the card of a stop names beside the stop itself: the workflow and the step in the team's words, and who worded the reason. */
export interface StopCardContext {
    /** The language of the team. */
    readonly locale: "vi" | "en"
    /** The workflow the run executes. */
    readonly workflow: { readonly moduleKey: string; readonly key: string; readonly title: string }
    /** The step, by key, installed node and title. */
    readonly step: { readonly key: string; readonly nodeId: string; readonly title: string }
    /** `ai`: the AI core worded the reason; `engine`: the AI itself failed and the engine's static words stand in. */
    readonly by: "ai" | "engine"
}

/** What a step that cannot complete hands the stops: who and where, why, what the founder is asked, and the card's words. */
export interface StopOpen {
    /** The workspace. */
    readonly workspaceId: string
    /** The run (the thread). */
    readonly runId: string
    /** The step that stopped. */
    readonly stepKey: string
    /** The agent of the run. */
    readonly agentId: string
    /** The workflow, or null. */
    readonly workflowId: string | null
    /** The customer, or null (a bank-fed run). */
    readonly leadId: string | null
    /** The conversation, or null (a bank-fed run). */
    readonly conversationId: string | null
    /** Why it stopped. */
    readonly kind: StopKind
    /** The reason. */
    readonly reason: string
    /** The question for the founder, or null. */
    readonly question: string | null
    /** The AI core's suggested ways on (at most three); none when the engine speaks. */
    readonly suggestions: ReadonlyArray<RunStopSuggestion>
    /** The engine's true facts, by name. */
    readonly facts: ReadonlyArray<RunStopFact>
    /** The card's context. */
    readonly card: StopCardContext
}

/**
 * How a stop is answered, the value `GraphThreads.resume` carries as its `decision`: the founder's words (a reply to the card on /chat,
 * or the card's box), one of the three buttons, or a NIVO deadline that passed.
 */
export type StopDecision =
    | { readonly kind: "answer"; readonly text: string; readonly by: string; readonly at: string }
    | { readonly kind: "retry" | "take_over" | "skip"; readonly by: string; readonly at: string }
    | { readonly kind: "timeout"; readonly at: string }

/** What the gate node hands `scope.stop`: the question of the thread's stop, plain JSON. */
export interface StopQuestion {
    /** The stop record. */
    readonly stopId: string
    /** The run. */
    readonly runId: string
    /** The step that stopped: where an answer or a retry sends the thread back. */
    readonly stepKey: string
    /** Why it stopped. */
    readonly kind: StopKind
    /** The reason. */
    readonly reason: string
    /** The question, or null. */
    readonly question: string | null
}

/** One answer of the founder as a step's turn reads it (`turn.founderAnswers`). */
export interface FounderAnswerJson {
    /** The founder's words. */
    readonly text: string
    /** When, ISO. */
    readonly at: string
}

/**
 * Where the gate sends the thread after a decision: back to the stopped step (`answer`, `retry`, `timeout`) with the founder's words
 * so far (the stop stays open until that run of the step completes), back to the gate itself (`take_over`: a person holds the
 * conversation, the stop stays open), or to the end (`skip`: the stop resolves at once).
 */
export interface StopRoute {
    /** The node the thread goes to: the step, the gate or `THREAD_END`. */
    readonly goto: string
    /** Every answer in words the stop received, oldest first: the whole `state.founderAnswers`. */
    readonly founderAnswers: ReadonlyArray<FounderAnswerJson>
    /** Whether the decision resolves the stop at once (`skip` only; the others resolve when the step completes). */
    readonly resolves: boolean
}

/** A customer send the per-stop guard refuses: the stop is open, the conversation was told already, and no answer came since. */
export interface StopSendRefusal {
    /** The refusal code the send door answers as a fact. */
    readonly code: "already_told_for_this_stop"
    /** The line already sent. */
    readonly line: RunStopCustomerLine
}
