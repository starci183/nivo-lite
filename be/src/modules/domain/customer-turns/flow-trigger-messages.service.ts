import { Injectable } from "@nestjs/common"
import type { FlowTriggerConversation, FlowTriggerMessage, FlowTriggerMessages } from "@modules/domain/agent-graphs"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import type { CustomerLine } from "@modules/domain/agent-messages"
import { ChatFilesService } from "@modules/domain/chat-files"

/** The most unanswered customer messages one run reads. */
const UNANSWERED_MAX = 30

/** The lines once each, in the order they were said. */
const linesInOrder = (lines: ReadonlyArray<CustomerLine>): ReadonlyArray<CustomerLine> =>
    [...new Map(lines.map((line) => [line.id, line])).values()].sort(
        (left, right) => left.at.getTime() - right.at.getTime() || left.id.localeCompare(right.id),
    )

@Injectable()
/**
 * The customer messages a node graph's run answers, for the graph's trigger: the messages its wake names (the message and the burst
 * merged into it) and every other one the customer said since the agent last replied, once each, in the order they were said, with
 * the files sent with them as short-lived addresses. A burst therefore reaches the graph whole even when a wake did not name it all.
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
        const [named, unanswered] = await Promise.all([
            this.messages.customerLinesOf(conversationId, messageIds),
            this.messages.unansweredLinesOf(conversationId, UNANSWERED_MAX),
        ])
        const lines = linesInOrder([...named, ...unanswered])
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
