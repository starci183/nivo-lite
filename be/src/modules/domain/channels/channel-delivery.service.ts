import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { InjectTelegram } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { InjectZalo, isZaloTokenRejection, zaloFailureOf } from "@modules/integrations/zalo"
import type { ZaloClient } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectChannelSenderRegistry } from "./channels.decorators"
import type { ChannelSenderRegistry, DeliveryRequest, DeliveryResult } from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"

/** Consultation messages are free for 48 hours after the customer's last interaction; later ones are paid or refused by Zalo. */
const ZALO_FREE_WINDOW_MS = 48 * 3_600_000

const DELIVERED: DeliveryResult = { delivered: true, failure: null }
const NOT_DELIVERED: DeliveryResult = { delivered: false, failure: null }

/** Archived conversations carry `<chat id>:<timestamp>`; the customer's id on the channel is the part before the colon. */
const customerIdOf = (externalId: string): string => externalId.replace(/:.*$/u, "")

@Injectable()
/**
 * Pushes the company's side of a conversation to the customer's real channel. Website conversations are read in the page itself, so only
 * channels with an external id need a push. The reply leaves through the connection the conversation came in on. A failure never throws:
 * the message is already stored and visible, and its verdict is written on it; a Zalo refresh that is busy is the one exception, because
 * the caller can simply try again.
 */
export class ChannelDeliveryService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectTelegram() private readonly telegram: TelegramClient,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectChannelSenderRegistry() private readonly senders: ChannelSenderRegistry,
        @InjectLogger() private readonly logger: Logger,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly secrets: ConnectionSecretsService,
        private readonly credentials: ZaloCredentialsService,
    ) {}

    /** Sends the reply on the conversation's channel and records the verdict on the stored message. */
    async deliver(request: DeliveryRequest): Promise<DeliveryResult> {
        const target = await this.conversations.targetOf(request.conversationId)
        if (target.kind !== "ok") return NOT_DELIVERED
        const result = await this.send(target.value, request.text)
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

    private async send(target: ConversationTarget, text: string): Promise<DeliveryResult> {
        if (target.channel === "website") return DELIVERED
        if (target.channel === "zalo") return this.sendZalo(target, text)
        const sender = this.senders.get(target.channel)
        if (sender !== undefined) return { delivered: await sender.send(target, text), failure: null }
        if (target.channel !== "telegram" || target.externalId === null) return NOT_DELIVERED
        return this.sendTelegram(target, target.externalId, text)
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

    private async sendZalo(target: ConversationTarget, text: string): Promise<DeliveryResult> {
        if (target.connectionId === null || target.externalId === null)
            return { delivered: false, failure: "zalo_not_connected" }
        const last = await this.messages.lastCustomerAt(target.id)
        if (last.kind === "ok" && this.clock.now().getTime() - last.value.getTime() > ZALO_FREE_WINDOW_MS) {
            return { delivered: false, failure: "zalo_window_expired" }
        }
        return this.sendZaloText(target.connectionId, customerIdOf(target.externalId), text).then(
            () => DELIVERED,
            (cause: unknown) => {
                if (cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy) throw cause
                this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
                    conversationId: target.id,
                    channel: "zalo",
                })
                return { delivered: false, failure: zaloFailureOf(cause) }
            },
        )
    }

    private async sendZaloText(connectionId: string, userId: string, text: string): Promise<void> {
        const token = await this.credentials.accessToken(connectionId)
        await this.zalo.sendCsText(token, userId, text).catch(async (cause: unknown) => {
            if (!isZaloTokenRejection(cause)) throw cause
            const renewed = await this.credentials.accessToken(connectionId, { stale: token })
            await this.zalo.sendCsText(renewed, userId, text)
        })
    }

    private failed(target: ConversationTarget, cause: unknown): DeliveryResult {
        this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
            conversationId: target.id,
            channel: target.channel,
        })
        return NOT_DELIVERED
    }
}
