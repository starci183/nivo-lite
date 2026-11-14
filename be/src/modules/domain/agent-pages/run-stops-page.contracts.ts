import type { StopCardApproval, StopCardKind, StopCardNeeds } from "@modules/domain/team-chat"

/** One page of the open stops. */
export interface RunStopsPage {
    /** The stops, newest first. */
    readonly stops: ReadonlyArray<RunStopView>
    /** How many stops of the workspace stand open. */
    readonly total: number
    /** The cursor of the next page, or null on the last. */
    readonly next: string | null
}

/** One open stop with what answering it needs (`stop.answer` / `decideRunStop`, or `run.step.decide` for an approval's verdict). */
export interface RunStopView {
    /** The stop. */
    readonly stopId: string
    /** The run (the thread) that waits. */
    readonly runId: string
    /** The step that stopped: what an answer names. */
    readonly stepKey: string
    /** approval, ai_report or ai_error. */
    readonly kind: StopCardKind
    /** Why it stopped, in the AI core's or the engine's words. */
    readonly reason: string
    /** The question for the founder, or null. */
    readonly question: string | null
    /** The AI core's suggested ways on. */
    readonly suggestions: ReadonlyArray<string>
    /** What the stop takes now: words, the buttons (retry / take_over / skip), the verdicts (approve / refuse). */
    readonly needs: StopCardNeeds
    /** What an approval asks to do (tool, account, ability, arguments), or null for any other stop. */
    readonly approval: StopCardApproval | null
    /** The agent of the run. */
    readonly agentId: string
    /** Its name, or null when the agent is gone. */
    readonly agentName: string | null
    /** The workflow the run executes, or null. */
    readonly workflowId: string | null
    /** Its name, or null. */
    readonly workflowName: string | null
    /** The customer the run is about, or null. */
    readonly contactId: string | null
    /** Their name, or null. */
    readonly contactName: string | null
    /** The customer conversation of the run, or null. */
    readonly conversationId: string | null
    /** How many times this step of this run stopped. */
    readonly repeats: number
    /** When it last stopped, ISO. */
    readonly stoppedAt: string
}
