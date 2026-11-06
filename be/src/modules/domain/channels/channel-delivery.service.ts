import { Injectable } from "@nestjs/common"
import { CHAT_DELIVERY_UNKNOWN, ChatConversationsService, ChatMessagesService } from "@modules/domain/chat-records"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { InjectTelegram, TelegramError, TelegramErrorCode } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { InjectZalo } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectChannelSenderRegistry } from "./channels.decorators"
import type { ChannelSenderRegistry, DeliveryRequest, DeliveryReceipt, PersonMessage } from "./channels.contracts"
import { ChannelPlanNoticeService } from "./channel-plan-notice.service"
import { deliveryFailureFieldsOf } from "./delivery-failure-fields.policy"
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
    if (receipt.outcome === "ambiguous") return CHAT_DELIVERY_UNKNOWN
    return receipt.failure ?? "delivery_rejected"
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
        private readonly conversations: ChatConversationsService,
        private readonly messages: ChatMessagesService,
        private readonly secrets: ConnectionSecretReadsService,
        private readonly credentials: ZaloCredentialsService,
        private readonly zaloDelivery: ZaloDeliveryService,
        private readonly planNotice: ChannelPlanNoticeService,
        @InjectTelegram() private readonly telegram: TelegramClient,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectChannelSenderRegistry() private readonly senders: ChannelSenderRegistry,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Sends the reply on the conversation's channel and records the verdict on the stored message. */
    async deliver(request: DeliveryRequest): Promise<DeliveryReceipt> {
        const target = await this.conversations.targetOf(request.workspaceId, request.conversationId)
        if (target.kind !== "ok") return NOT_DELIVERED
        const message = await this.messages.find(request.workspaceId, request.conversationId, request.messageId)
        if (message.kind !== "ok") return NOT_DELIVERED
        const settled = await this.settledClaim(target.value, request)
        if (settled !== undefined) return settled
        const result = await this.attempt(target.value, { ...request, text: message.value.body })
        if (result.outcome === "rejected" && !recipientLinked(target.value)) {
            return this.keptUndelivered(target.value, request.messageId)
        }
        await this.messages.markDelivery(
            request.workspaceId,
            request.messageId,
            result.delivered,
            deliveryErrorOf(result),
        )
        if (result.failure === "channel_plan") await this.planNotice.planBlocked(target.value)
        if (result.delivered && target.value.connectionId !== null) await this.planNotice.recovered(target.value)
        return result
    }

    /** Shows "typing" in the customer's chat while the AI works; only Telegram has it, and a failure here never stops the reply. */
    async showTyping(target: ChatConversationTarget): Promise<void> {
        if (target.channel !== "telegram" || target.externalId === null || target.connectionId === null) return
        const token = await this.secrets.botToken(target.workspaceId, target.connectionId)
        if (token.kind === "ok") await this.telegram.sendTyping(token.value, customerIdOf(target.externalId))
    }

    /** The customer's name on the channel, or an empty text when the channel will not say (only Zalo is asked). The name only labels the conversation. */
    customerName(target: ChatConversationTarget): Promise<string> {
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

    /** The receipt of a message whose delivery is already decided, or undefined when this call may send it; a website conversation is read in the page and claims nothing. */
    private async settledClaim(
        target: ChatConversationTarget,
        request: DeliveryRequest,
    ): Promise<DeliveryReceipt | undefined> {
        if (target.channel === "website") return undefined
        const claim = await this.messages.claimDelivery(request.workspaceId, request.conversationId, request.messageId)
        if (claim === "acknowledged") return DELIVERED
        if (claim === "ambiguous") return UNKNOWN
        return claim === "missing" ? NOT_DELIVERED : undefined
    }

    /** Sends the reply; a failure becomes a receipt, except a busy Zalo refresh, which marks the message rejected and is rethrown for the caller to retry. */
    private async attempt(target: ChatConversationTarget, request: DeliveryRequest): Promise<DeliveryReceipt> {
        try {
            return await this.send(target, request)
        } catch (cause) {
            if (!(cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy))
                return this.failed(target, cause)
            await this.messages.markDelivery(request.workspaceId, request.messageId, false, "delivery_rejected")
            throw cause
        }
    }

    private async send(target: ChatConversationTarget, request: DeliveryRequest): Promise<DeliveryReceipt> {
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

    private async sendTelegram(
        target: ChatConversationTarget,
        externalId: string,
        text: string,
    ): Promise<DeliveryReceipt> {
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
    private async keptUndelivered(target: ChatConversationTarget, messageId: string): Promise<DeliveryReceipt> {
        await this.messages.markDelivery(target.workspaceId, messageId, false, RECIPIENT_NOT_LINKED)
        this.logger.info(ChannelsLogEvent.RecipientNotLinked, { conversationId: target.id, channel: target.channel })
        return NOT_DELIVERED
    }

    private failed(target: ChatConversationTarget, cause: unknown): DeliveryReceipt {
        this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
            conversationId: target.id,
            channel: target.channel,
            ...deliveryFailureFieldsOf(cause),
        })
        return cause instanceof TelegramError && cause.code === TelegramErrorCode.Rejected ? NOT_DELIVERED : UNKNOWN
    }
}
