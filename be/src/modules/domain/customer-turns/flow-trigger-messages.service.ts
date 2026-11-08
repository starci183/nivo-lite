import { Injectable } from "@nestjs/common"
import type { FlowTriggerConversation, FlowTriggerMessage, FlowTriggerMessages } from "@modules/domain/agent-graphs"
import { ChatConversationsService, ChatMessagesService, type ChatCustomerLine } from "@modules/domain/chat-records"

/** The most unanswered customer messages one run reads. */
const UNANSWERED_MAX = 30

/** The lines once each, in the order they were said. */
const linesInOrder = (lines: ReadonlyArray<ChatCustomerLine>): ReadonlyArray<ChatCustomerLine> =>
    [...new Map(lines.map((line) => [line.id, line])).values()].sort(
        (left, right) => left.at.getTime() - right.at.getTime() || left.id.localeCompare(right.id),
    )

@Injectable()
/**
 * The customer messages a node graph's run answers, for the graph's trigger: the messages its wake names (the message and the burst
 * merged into it) and every other one the customer said since the agent last replied, once each, in the order they were said. A burst
 * therefore reaches the graph whole even when a wake did not name it all. Customers' pictures and files are not stored, so a message
 * carries none.
 */
export class FlowTriggerMessagesService implements FlowTriggerMessages {
    constructor(
        private readonly messages: ChatMessagesService,
        private readonly conversations: ChatConversationsService,
    ) {}

    /** The conversation's customer and channel, or null when it is gone. */
    async conversationOf(workspaceId: string, conversationId: string): Promise<FlowTriggerConversation | null> {
        const found = await this.conversations.turnOf(workspaceId, conversationId)
        return found.kind === "ok" ? { leadId: found.value.leadId, channel: found.value.channel } : null
    }

    /** The customer's messages among the ids, in the order they were said. */
    async messagesOf(
        workspaceId: string,
        conversationId: string,
        messageIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<FlowTriggerMessage>> {
        const [named, unanswered] = await Promise.all([
            this.messages.customerLinesOf(workspaceId, conversationId, messageIds),
            this.messages.unansweredLinesOf(workspaceId, conversationId, UNANSWERED_MAX),
        ])
        return linesInOrder([...named, ...unanswered]).map((line) => ({
            id: line.id,
            text: line.body,
            at: line.at.toISOString(),
            attachments: [],
        }))
    }
}
