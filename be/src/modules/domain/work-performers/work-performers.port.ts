import type { AgentInput, Classification, AiTaskScope, ExtractedOrder, LeadInput } from "@modules/domain/ai-tasks"

/** The prompts the performers write with (owner: the ai-tasks prompt library; the app root binds it). */
export interface PromptWriter {
    /** The outbound message that performs the next action of a lead. */
    draftFollowUp(
        scope: AiTaskScope,
        lead: LeadInput,
        context: string,
        nextAction: string,
        agent: AgentInput | null,
        brief: string,
    ): Promise<string>
    /** A short thank-you after the customer paid. */
    draftCare(scope: AiTaskScope, lead: LeadInput, paymentNote: string, brief: string): Promise<string>
    /** The stage, next step, gaps and context brief of a lead. */
    classifyLead(
        scope: AiTaskScope,
        lead: LeadInput,
        history: ReadonlyArray<string>,
        brief: string,
    ): Promise<Classification>
    /** An order read from free text. */
    extractOrder(scope: AiTaskScope, text: string): Promise<ExtractedOrder>
}
