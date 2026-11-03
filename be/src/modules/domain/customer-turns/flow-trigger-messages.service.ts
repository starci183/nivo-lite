import { Injectable } from "@nestjs/common"
import type { FlowTriggerConversation, FlowTriggerMessage, FlowTriggerMessages } from "@modules/domain/agent-graphs"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChatFilesService } from "@modules/domain/chat-files"

@Injectable()
/**
 * The customer messages a node graph's run answers, for the graph's trigger: the words and times of the conversation's own messages
 * and the files sent with them as short-lived addresses. It reads only messages of the customer in the conversation the wake names.
 */
export class FlowTriggerMessagesService implements FlowTriggerMessages {
    constructor(
        private readonly messages: AgentMessagesService,
        private readonly files: ChatFilesService,
        private readonly conversations: AgentConversationsService,
    ) {}

    /** The conversation's customer and channel, or null when it is gone. */
    async conversationOf(conversationId: string): Promise<FlowTriggerConversation | null> {
        const found = await this.conversations.turnOf(conversationId)
        return found.kind === "ok" ? { leadId: found.value.leadId, channel: found.value.channel } : null
    }

    /** The customer's messages among the ids, in the order they were said, with their files. */
    async messagesOf(
        workspaceId: string,
        conversationId: string,
        messageIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<FlowTriggerMessage>> {
        const lines = await this.messages.customerLinesOf(conversationId, messageIds)
        const files = await this.files.viewsOf(
            workspaceId,
            lines.map((line) => line.id),
        )
        return lines.map((line) => ({
            id: line.id,
            text: line.body,
            at: line.at.toISOString(),
            attachments: files
                .filter((file) => file.messageId === line.id)
                .map((file) => ({ id: file.id, name: file.name, contentType: file.contentType, url: file.url })),
        }))
    }
}
