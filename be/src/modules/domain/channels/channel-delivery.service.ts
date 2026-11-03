import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService, DELIVERY_OUTCOME_UNKNOWN } from "@modules/domain/agent-messages"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { InjectTelegram, TelegramError, TelegramErrorCode } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { InjectZalo } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectChannelSenderRegistry } from "./channels.decorators"
import type { ChannelSenderRegistry, DeliveryRequest, DeliveryReceipt, PersonMessage } from "./channels.contracts"
import { RECIPIENT_NOT_LINKED, recipientLinked } from "./delivery-recipient.policy"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"

const DELIVERED: DeliveryReceipt = { delivered: true, failure: null, outcome: "acknowledged" }
const NOT_DELIVERED: DeliveryReceipt = { delivered: false, failure: null, outcome: "rejected" }
const UNKNOWN: DeliveryReceipt = { delivered: false, failure: null, outcome: "ambiguous" }

/** The stored delivery failure keeps an uncertain remote receipt fenced; a definite refusal alone may retry. */
const deliveryErrorOf = (receipt: DeliveryReceipt): string | undefined => {
    if (receipt.delivered) return undefined
    if (receipt.outcome === "ambiguous") return DELIVERY_OUTCOME_UNKNOWN
    return receipt.failure === null || receipt.failure === "zalo_error" ? "delivery_rejected" : receipt.failure
}

/** Archived conversations carry `<chat id>:<timestamp>`; the customer's id on the channel is the part before the colon. */
const customerIdOf = (externalId: string): string => {
    // A suffix belongs to the final logical line; earlier line breaks keep their stored text.
    const lineStart =
        Math.max(
            externalId.lastIndexOf("\n"),
            externalId.lastIndexOf("\r"),
            externalId.lastIndexOf(" "),
            externalId.lastIndexOf(" "),
        ) + 1
    const suffix = externalId.indexOf(":", lineStart)
    return suffix < 0 ? externalId : externalId.slice(0, suffix)
}

@Injectable()
/**
 * Pushes the company's side of a conversation to the customer's real channel. Website conversations are read in the page itself, so only
 * channels with an external id need a push. The reply leaves through the connection the conversation came in on; Zalo has its own route
 * (window, QR image, ZNS fallback). A failure never throws: the message is already stored and visible, and its verdict is written on it;
 * a Zalo refresh that is busy is the one exception, because the caller can simply try again.
 */
export class ChannelDeliveryService {
    constructor(
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly secrets: ConnectionSecretReadsService,
        private readonly credentials: ZaloCredentialsService,
        private readonly zaloDelivery: ZaloDeliveryService,
        @InjectTelegram() private readonly telegram: TelegramClient,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectChannelSenderRegistry() private readonly senders: ChannelSenderRegistry,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Sends the reply on the conversation's channel and records the verdict on the stored message. */
    async deliver(request: DeliveryRequest): Promise<DeliveryReceipt> {
        const target = await this.conversations.targetOf(request.conversationId)
        if (target.kind !== "ok") return NOT_DELIVERED
        const message = await this.messages.find(request.messageId, request.conversationId)
        if (message.kind !== "ok") return NOT_DELIVERED
        if (target.value.channel !== "website") {
            const claim = await this.messages.claimDelivery(request.messageId, request.conversationId)
            if (claim === "acknowledged") return DELIVERED
            if (claim === "ambiguous") return UNKNOWN
            if (claim === "missing") return NOT_DELIVERED
        }
        let result: DeliveryReceipt
        try {
            result = await this.send(target.value, { ...request, text: message.value.body })
        } catch (cause) {
            if (cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy) {
                await this.messages.markDelivery(request.messageId, false, "delivery_rejected")
                throw cause
            }
            result = this.failed(target.value, cause)
        }
        if (result.outcome === "rejected" && !recipientLinked(target.value)) {
            return this.keptUndelivered(target.value, request.messageId)
        }
        await this.messages.markDelivery(request.messageId, result.delivered, deliveryErrorOf(result))
        return result
    }

    /** Shows "typing" in the customer's chat while the AI works; only Telegram has it, and a failure here never stops the reply. */
    async showTyping(target: ConversationTarget): Promise<void> {
        if (target.channel !== "telegram" || target.externalId === null || target.connectionId === null) return
        const token = await this.secrets.botToken(target.workspaceId, target.connectionId)
        if (token.kind === "ok") await this.telegram.sendTyping(token.value, customerIdOf(target.externalId))
    }

    /** The customer's name on the channel, or an empty text when the channel will not say (only Zalo is asked). The name only labels the conversation. */
    customerName(target: ConversationTarget): Promise<string> {
        if (target.channel !== "zalo" || target.externalId === null || target.connectionId === null)
            return Promise.resolve("")
        const userId = customerIdOf(target.externalId)
        return this.credentials
            .accessToken(target.connectionId)
            .then((token) => this.zalo.userDisplayName(token, userId))
            .catch((cause: unknown) => {
                this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
                    conversationId: target.id,
                    channel: "zalo",
                })
                return ""
            })
    }

    /**
     * Sends one text to a person outside any conversation (a shift message to a staff member): a Telegram chat through the workspace's
     * bot on that connection, or a Zalo user through the OA (a rejected token is refreshed once). Throws when it did not go out, so the
     * caller records the failure; no 48-hour window applies, the person is staff, not a customer.
     */
    async sendToPerson(request: PersonMessage): Promise<void> {
        if (request.provider === "zalo_oa") {
            await this.zaloDelivery.sendText(request.connectionId, request.recipientId, request.text)
            return
        }
        const token = await this.secrets.botToken(request.workspaceId, request.connectionId)
        if (token.kind !== "ok") throw new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
        await this.telegram.sendMessage(token.value, request.recipientId, request.text)
    }

    private async send(target: ConversationTarget, request: DeliveryRequest): Promise<DeliveryReceipt> {
        if (target.channel === "website") return DELIVERED
        if (target.channel === "zalo") {
            const userId = target.externalId === null ? null : customerIdOf(target.externalId)
            const result = await this.zaloDelivery.send(target, userId, request)
            return { ...result, outcome: result.outcome ?? (result.delivered ? "acknowledged" : "ambiguous") }
        }
        const sender = this.senders.get(target.channel)
        if (sender !== undefined) {
            const sent = await sender.send(target, request.text)
            return sent ? DELIVERED : UNKNOWN
        }
        if (target.channel !== "telegram" || target.externalId === null) return NOT_DELIVERED
        return this.sendTelegram(target, target.externalId, request.text)
    }

    private async sendTelegram(target: ConversationTarget, externalId: string, text: string): Promise<DeliveryReceipt> {
        if (target.connectionId === null) return NOT_DELIVERED
        const token = await this.secrets.botToken(target.workspaceId, target.connectionId)
        if (token.kind !== "ok") return NOT_DELIVERED
        return this.telegram.sendMessage(token.value, customerIdOf(externalId), text).then(
            () => DELIVERED,
            (cause: unknown) => this.failed(target, cause),
        )
    }

    /**
     * A reply the channel refused to a customer with no recipient on it yet stays in the conversation, marked as not sent for want of a
     * recipient (the same verdict a graph's send keeps), not as a refusal of the channel. A route that reaches such a customer anyway
     * (a Zalo fallback) still delivers.
     */
    private async keptUndelivered(target: ConversationTarget, messageId: string): Promise<DeliveryReceipt> {
        await this.messages.markDelivery(messageId, false, RECIPIENT_NOT_LINKED)
        this.logger.info(ChannelsLogEvent.RecipientNotLinked, { conversationId: target.id, channel: target.channel })
        return NOT_DELIVERED
    }

    private failed(target: ConversationTarget, cause: unknown): DeliveryReceipt {
        this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
            conversationId: target.id,
            channel: target.channel,
        })
        return cause instanceof TelegramError && cause.code === TelegramErrorCode.Rejected ? NOT_DELIVERED : UNKNOWN
    }
}
