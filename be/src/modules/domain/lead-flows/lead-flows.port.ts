import type { DeepseekScope, LeadTurnInput } from "@modules/integrations/deepseek"

/** The one model reading of a prospect's turn (owner: the deepseek prompt library; the capability binds it). */
export interface LeadTurnReader {
    /** Reads one turn into the JSON object the lead flow validates. */
    readLeadTurn(scope: DeepseekScope, input: LeadTurnInput): Promise<object>
}
