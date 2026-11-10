import type { Locale } from "@modules/platform/i18n"

/** What a person answers the decision a run waits on. */
export type AgentRunVerdict = "approve" | "retry" | "reject"

/** What answering the decision of a run takes. */
export interface DecideAgentRunStepRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string
    /** The run. */
    readonly runId: string
    /** The answer. */
    readonly verdict: AgentRunVerdict
    /** The language of the generated text. */
    readonly locale: Locale
}

/** Why the answer was not taken: nothing waits on the run, the seat may not answer it, somebody settled it first, or the answer is not one of those offered. */
export type AgentRunDecideRefusal = "decision_not_found" | "decision_closed" | "not_an_approver" | "option_not_offered"

/** How answering ended: taken, so the run goes on as it would from the inbox, or why it was refused. */
export type DecideAgentRunStepOutcome =
    | { readonly ok: true; readonly refusal: null }
    | { readonly ok: false; readonly refusal: AgentRunDecideRefusal }
