import type {
    AgentInput,
    Classification,
    DeepseekScope,
    ExtractedOrder,
    LeadInput,
} from "@modules/integrations/deepseek"

/** The prompts the performers write with (owner: the deepseek prompt library; the app root binds it). */
export interface PromptWriter {
    /** The outbound message that performs the next action of a lead. */
    draftFollowUp(
        scope: DeepseekScope,
        lead: LeadInput,
        context: string,
        nextAction: string,
        agent: AgentInput | null,
        brief: string,
    ): Promise<string>
    /** A short thank-you after the customer paid. */
    draftCare(scope: DeepseekScope, lead: LeadInput, paymentNote: string, brief: string): Promise<string>
    /** The stage, next step, gaps and context brief of a lead. */
    classifyLead(
        scope: DeepseekScope,
        lead: LeadInput,
        history: ReadonlyArray<string>,
        brief: string,
    ): Promise<Classification>
    /** An order read from free text. */
    extractOrder(scope: DeepseekScope, text: string): Promise<ExtractedOrder>
}
