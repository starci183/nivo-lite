import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { InjectTelegram } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { InjectZalo } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectChannelSenderRegistry } from "./channels.decorators"
import type { ChannelSenderRegistry, DeliveryRequest, DeliveryResult, PersonMessage } from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"

const DELIVERED: DeliveryResult = { delivered: true, failure: null }
const NOT_DELIVERED: DeliveryResult = { delivered: false, failure: null }

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
    async deliver(request: DeliveryRequest): Promise<DeliveryResult> {
        const target = await this.conversations.targetOf(request.conversationId)
        if (target.kind !== "ok") return NOT_DELIVERED
        const result = await this.send(target.value, request)
        await this.messages.markDelivery(request.messageId, result.delivered, result.failure ?? undefined)
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

    private async send(target: ConversationTarget, request: DeliveryRequest): Promise<DeliveryResult> {
        if (target.channel === "website") return DELIVERED
        if (target.channel === "zalo") {
            const userId = target.externalId === null ? null : customerIdOf(target.externalId)
            return this.zaloDelivery.send(target, userId, request)
        }
        const sender = this.senders.get(target.channel)
        if (sender !== undefined) return { delivered: await sender.send(target, request.text), failure: null }
        if (target.channel !== "telegram" || target.externalId === null) return NOT_DELIVERED
        return this.sendTelegram(target, target.externalId, request.text)
    }

    private async sendTelegram(target: ConversationTarget, externalId: string, text: string): Promise<DeliveryResult> {
        if (target.connectionId === null) return NOT_DELIVERED
        const token = await this.secrets.botToken(target.workspaceId, target.connectionId)
        if (token.kind !== "ok")
            return this.failed(target, new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound }))
        return this.telegram.sendMessage(token.value, customerIdOf(externalId), text).then(
            () => DELIVERED,
            (cause: unknown) => this.failed(target, cause),
        )
    }

    private failed(target: ConversationTarget, cause: unknown): DeliveryResult {
        this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
            conversationId: target.id,
            channel: target.channel,
        })
        return NOT_DELIVERED
    }
}
