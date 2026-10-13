import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationLeads, OptionalLeadId, ToolContext } from "@modules/domain/agent-tools"

@Injectable()
/** The lead a conversation is tied to, for the evidence trace of an agent tool call. */
export class ConversationLeadsService implements ConversationLeads {
    constructor(private readonly conversations: AgentConversationsService) {}

    /** The lead of the job's conversation, or null when the customer is not a lead yet. */
    async leadIdOf(ctx: ToolContext): Promise<OptionalLeadId> {
        const turn = await this.conversations.turnOf(ctx.conversationId)
        return turn.kind === "ok" ? turn.value.leadId : null
    }
}
