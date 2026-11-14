/** What a person answers the decision a run waits on. */
export type AgentRunVerdict = "approve" | "retry" | "reject"

/** Why the answer was not taken: nothing waits on the run, the seat may not answer it, somebody settled it first, or the answer is not one of those offered. */
export type AgentRunDecideRefusal = "decision_not_found" | "decision_closed" | "not_an_approver" | "option_not_offered"

/** How answering ended: taken, so the run goes on as it would from the inbox, or why it was refused. */
export type DecideAgentRunStepOutcome =
    | { readonly ok: true; readonly refusal: null; readonly accepted: null }
    | {
          readonly ok: false
          readonly refusal: AgentRunDecideRefusal
          /** For `option_not_offered`: the verdicts the waiting item takes; null for every other refusal. */
          readonly accepted: ReadonlyArray<AgentRunVerdict> | null
      }
