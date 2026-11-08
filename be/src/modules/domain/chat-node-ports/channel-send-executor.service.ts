import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EffectCall, EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { ChannelDeliveryService, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService, type ChatTurnConversation } from "@modules/domain/chat-records"
import { GraphNodeRegistryService, type NodeEffectExecutor, type NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import {
    RECIPIENT_NOT_LINKED,
    channelBusy,
    placeholderRecipient,
    recipientLinked,
    recipientRefused,
    textWithLinks,
} from "./chat-node-ports.policy"
import { channelSendSchema } from "./chat-node-ports.schema"
import { ChatNodePortsLogEvent } from "./chat-node-ports.log-events"
import { ChatNodePortsError, ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

/** What one push answers: delivered, or why not. */
type DeliveryReceipt = Awaited<ReturnType<ChannelDeliveryService["deliver"]>>

const EFFECT = "channel.send"

@Injectable()
/**
 * The executor of the `channel.send` effect: it sends one text to a customer conversation through the outbound path (the
 * message is stored on the conversation record, then pushed to Zalo OA, Telegram or the web). It speaks only where the agent may: in the
 * conversation of the running turn, never once a person took it over or another agent holds it, and never on Zalo after the free
 * 48-hour window closed. Each of those is a refusal with a code, never a silent drop and never a send outside the rule. A message that
 * did not leave stays in the conversation marked not sent AND ends the step with an error: a completed step always means the channel took the message.
 */
export class ChannelSendExecutorService implements NodeEffectExecutor, OnModuleInit {
    /** The effect it runs. */
    readonly effect: "channel.send" = EFFECT

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        private readonly delivery: ChannelDeliveryService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor once the app has started. */
    onModuleInit(): void {
        this.registry?.addExecutor(this)
    }

    /**
     * Stores the text once per effect call (a retry of the same call finds the line under its key and only pushes again) and pushes it; answers the
     * stored message. A message that cannot leave (a recipient the channel cannot reach, a plan that does not allow the reply, any other
     * refusal of a rule or of the channel) is kept in the conversation as not sent and throws, so the step is parked and the run is
     * never reported as done.
     */
    async execute(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> {
        try {
            const sent = await this.send(turn, payload, call)
            this.logger.info(ChatNodePortsLogEvent.Sent, { turnId: turn.turnId, messageId: sent.id })
            return sent
        } catch (cause) {
            if (cause instanceof ChatNodePortsError) {
                this.logger.warn(ChatNodePortsLogEvent.SendFailed, { turnId: turn.turnId, code: cause.code })
            }
            throw cause
        }
    }

    /** The send itself: the checks, the store, the push and the verdict. */
    private async send(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<SubjectRef> {
        const parsed = channelSendSchema.safeParse(payload)
        if (!parsed.success) throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.InvalidPayload })
        const conversation = await this.conversationOf(turn, parsed.data.conversationId)
        if (conversation.handledBy !== null) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.HeldByPerson })
        }
        if (!this.speaks(turn, conversation)) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.NotSpeaking })
        }
        const linked = recipientLinked(conversation) && !placeholderRecipient(conversation)
        if (
            linked &&
            conversation.channel === "zalo" &&
            (await this.windowClosed(conversation.workspaceId, conversation.id))
        ) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ZaloWindowExpired })
        }
        const text = textWithLinks(parsed.data)
        const stored = await this.messages.storeAgentLine({
            workspaceId: conversation.workspaceId,
            conversationId: conversation.id,
            body: text,
            key: call.dedupeKey ?? call.key,
            sentBy: turn.agentId,
        })
        const messageId = stored.id
        if (!linked) return this.keptUndelivered(conversation, messageId)
        const receipt = await this.delivery.deliver({
            workspaceId: conversation.workspaceId,
            conversationId: conversation.id,
            messageId,
            text,
        })
        if (!receipt.delivered) return this.refused(conversation, messageId, receipt)
        return { kind: "message", id: messageId }
    }

    /**
     * Whether the agent of the turn may speak in the conversation: it is the agent of the conversation, or the run was woken by a hand-off
     * that the agent of the conversation made from that very conversation (the run serves it and its tag named the holder as the author).
     * Any other agent stays refused. The conversation keeps its agent; the hand-off lends the right to speak for the run, it does not move
     * the conversation.
     */
    private speaks(turn: NodeTurn, conversation: ChatTurnConversation): boolean {
        if (conversation.agent.id === turn.agentId) return true
        return turn.conversationId === conversation.id && turn.handedOffBy === conversation.agent.id
    }

    /** What a refused push ends the step with: a plan that does not allow the reply, a recipient the channel cannot reach, a channel not taking messages for now (tried again), a rejection, or an outcome nobody knows. */
    private refused(conversation: ChatTurnConversation, messageId: string, receipt: DeliveryReceipt): Promise<never> {
        if (receipt.failure === "channel_plan") return Promise.resolve(this.keptPlanBlocked(conversation))
        const rejected = receipt.outcome === "rejected"
        if (rejected && recipientRefused(receipt.failure)) return this.keptUndelivered(conversation, messageId)
        if (rejected && channelBusy(receipt.failure)) {
            return Promise.reject(new ChatNodePortsError({ code: ChatNodePortsErrorCode.DeliveryRateLimited }))
        }
        const code = rejected ? ChatNodePortsErrorCode.DeliveryRejected : ChatNodePortsErrorCode.DeliveryUnconfirmed
        return Promise.reject(new ChatNodePortsError({ code }))
    }

    /** The message stays in the conversation for the owner to see, marked as not sent, and the step fails: the customer cannot be reached, and a run must not report done for a message nobody received. */
    private async keptUndelivered(conversation: ChatTurnConversation, messageId: string): Promise<never> {
        await this.messages.markDelivery(conversation.workspaceId, messageId, false, RECIPIENT_NOT_LINKED)
        this.logger.info(ChatNodePortsLogEvent.Undelivered, {
            conversationId: conversation.id,
            channel: conversation.channel,
            reason: RECIPIENT_NOT_LINKED,
        })
        throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.RecipientUnreachable })
    }

    /** The plan of the channel does not let the agent answer: the message stays in the conversation marked as such (the channel layer stored the reason and told the owner once), and the step fails, since no retry can help and nobody received it. */
    private keptPlanBlocked(conversation: ChatTurnConversation): never {
        this.logger.info(ChatNodePortsLogEvent.PlanBlocked, {
            conversationId: conversation.id,
            channel: conversation.channel,
        })
        throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ChannelPlanBlocked })
    }

    private async conversationOf(turn: NodeTurn, conversationId: string): Promise<ChatTurnConversation> {
        if (turn.conversationId !== null && turn.conversationId !== conversationId) {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.WrongConversation })
        }
        const found = await this.conversations.turnOf(turn.workspaceId, conversationId)
        if (found.kind !== "ok") {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.ConversationNotFound })
        }
        return found.value
    }

    /** True when the customer last wrote longer ago than the free window; a conversation they never wrote in is open. */
    private async windowClosed(workspaceId: string, conversationId: string): Promise<boolean> {
        const last = await this.messages.lastCustomerAt(workspaceId, conversationId)
        return last.kind === "ok" && this.clock.now().getTime() - last.value.getTime() > ZALO_FREE_WINDOW_MS
    }
}
