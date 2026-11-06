import { Injectable } from "@nestjs/common"
import type { ConversationLeads, OptionalToolLeadId, ToolContext } from "@modules/domain/agent-tools"
import { ChatConversationsService } from "@modules/domain/chat-records"

@Injectable()
/** The lead a conversation is tied to, for the evidence trace of an agent tool call. */
export class ConversationLeadsService implements ConversationLeads {
    constructor(private readonly conversations: ChatConversationsService) {}

    /** The lead of the job's conversation, or null when the customer is not a lead yet or the conversation is gone. */
    async leadIdOf(ctx: ToolContext): Promise<OptionalToolLeadId> {
        const found = await this.conversations.humanOf(ctx.workspaceId, ctx.conversationId)
        return found?.leadId ?? null
    }
}
