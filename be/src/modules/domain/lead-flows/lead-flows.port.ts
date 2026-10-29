import type { AiTaskScope, LeadTurnInput } from "@modules/domain/ai-tasks"

/** The one model reading of a prospect's turn (owner: the ai-tasks prompt library; the capability binds it). */
export interface LeadTurnReader {
    /** Reads one turn into the JSON object the lead flow validates. */
    readLeadTurn(scope: AiTaskScope, input: LeadTurnInput): Promise<object>
}
