import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RECIPIENT_NOT_LINKED, recipientLinked, textWithLinks } from "./chat-node-ports.policy"
import { channelSendSchema } from "./chat-node-ports.schema"
import { ChatNodePortsLogEvent } from "./chat-node-ports.log-events"
import { ChatNodePortsError, ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

const EFFECT = "channel.send"

@Injectable()
/**
 * The executor of the `channel.send` effect: it sends one text to a customer conversation through the existing outbound path (the
 * message is stored in the conversation, then pushed to Zalo OA, Telegram or the web). It speaks only where the agent may: in the
 * conversation of the running turn, never once a person took it over or another agent holds it, and never on Zalo after the free
 * 48-hour window closed. Each of those is a refusal with a code, never a silent drop and never a send outside the rule.
 */
export class ChannelSendExecutorService implements NodeEffectExecutor, OnModuleInit {
    /** The effect it runs. */
    readonly effect: "channel.send" = EFFECT

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly registry: GraphNodeRegistryService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly delivery: ChannelDeliveryService,
    ) {}

    /** Registers the executor once the app has started. */
    onModuleInit(): void {
        this.registry.addExecutor(this)
    }

    /** Stores and pushes the text; answers the stored message, and throws when a rule or the channel refused. */
    async execute(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const parsed = channelSendSchema.safeParse(payload)
        if (!parsed.success) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.InvalidPayload })
        const conversation = await this.conversationOf(turn, parsed.data.conversationId)
        if (conversation.handledBy !== null) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.HeldByPerson })
        }
        if (conversation.agent.id !== turn.agentId) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.NotSpeaking })
        }
        const linked = recipientLinked(conversation)
        if (linked && conversation.channel === "zalo" && (await this.windowClosed(conversation.id))) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ZaloWindowExpired })
        }
        const text = textWithLinks(parsed.data)
        const messageId = await this.messages.storeAgentMessage(conversation.workspaceId, conversation.id, text)
        if (!linked) return this.keptUndelivered(conversation, messageId)
        const receipt = await this.delivery.deliver({ conversationId: conversation.id, messageId, text })
        if (!receipt.delivered) {
            const code =
                receipt.outcome === "rejected"
                    ? ChatNodePortsErrorCode.DeliveryRejected
                    : ChatNodePortsErrorCode.DeliveryUnconfirmed
            throw new ChatNodePortsError({ code })
        }
        return { kind: "message", id: messageId }
    }

    /** The message stays in the conversation for the owner to see, marked as not sent; the customer cannot be reached yet, which is not a failure of the step. */
    private async keptUndelivered(conversation: TurnConversation, messageId: string): Promise<SubjectRef> {
        await this.messages.markDelivery(messageId, false, RECIPIENT_NOT_LINKED)
        this.logger.info(ChatNodePortsLogEvent.Undelivered, {
            conversationId: conversation.id,
            channel: conversation.channel,
            reason: RECIPIENT_NOT_LINKED,
        })
        return { kind: "message", id: messageId }
    }

    private async conversationOf(turn: NodeTurn, conversationId: string): Promise<TurnConversation> {
        if (turn.conversationId !== null && turn.conversationId !== conversationId) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.WrongConversation })
        }
        const found = await this.conversations.turnOf(conversationId)
        if (found.kind !== "ok" || found.value.workspaceId !== turn.workspaceId) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ConversationNotFound })
        }
        return found.value
    }

    /** True when the customer last wrote longer ago than the free window; a conversation they never wrote in is open. */
    private async windowClosed(conversationId: string): Promise<boolean> {
        const last = await this.messages.lastCustomerAt(conversationId)
        return last.kind === "ok" && this.clock.now().getTime() - last.value.getTime() > ZALO_FREE_WINDOW_MS
    }
}
