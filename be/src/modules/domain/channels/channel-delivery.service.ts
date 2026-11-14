import { Injectable } from "@nestjs/common"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { InjectTelegram, TelegramError, TelegramErrorCode, type TelegramClient } from "@modules/integrations/telegram"
import { InjectZalo, type ZaloClient } from "@modules/integrations/zalo"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { InjectChannelSenderRegistry } from "./channels.decorators"
import type {
    ChannelSenderRegistry,
    ChannelTarget,
    DeliveryReceipt,
    DeliveryRequest,
    PersonDeliveryRequest,
    PersonMessage,
} from "./channels.contracts"
import { TelegramPicturesService } from "./telegram-pictures.service"
import { ChannelPlanNoticeService } from "./channel-plan-notice.service"
import { customerIdOf } from "./customer-id.policy"
import { deliveryFailureFieldsOf } from "./delivery-failure-fields.policy"
import { withQrPicture } from "./qr-image.policy"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"

const DELIVERED: DeliveryReceipt = { delivered: true, failure: null, outcome: "acknowledged" }
const NOT_DELIVERED: DeliveryReceipt = { delivered: false, failure: null, outcome: "rejected" }
const UNKNOWN: DeliveryReceipt = { delivered: false, failure: null, outcome: "ambiguous" }

@Injectable()
/**
 * Pushes one message to the customer's real channel, for the one customer send: it reads and writes no conversation record, the engine's
 * delivery ledger fences each send key around it. The message leaves through the account the person is reached through; Zalo has its
 * own route (QR image, the window the caller judged). A failure becomes a receipt, never a throw, except a busy Zalo token refresh, which the
 * caller settles and retries.
 */
export class ChannelDeliveryService {
    constructor(
        private readonly secrets: ConnectionSecretReadsService,
        private readonly credentials: ZaloCredentialsService,
        private readonly zaloDelivery: ZaloDeliveryService,
        private readonly planNotice: ChannelPlanNoticeService,
        private readonly pictures: TelegramPicturesService,
        @InjectTelegram() private readonly telegram: TelegramClient,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectChannelSenderRegistry() private readonly senders: ChannelSenderRegistry,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * Sends one message to a PERSON on one of their channel identities and answers the channel's receipt. It reads and writes no conversation
     * record: the executor of the customer send fences the send key in the engine's delivery ledger around this call and settles it from
     * the receipt. The route, the account and the person's id on the channel come with the request; the Zalo window is judged by the caller
     * (`windowChecked`). A failure becomes a receipt, except a busy Zalo token refresh, which is thrown for the caller to settle and retry.
     */
    async deliverToPerson(request: PersonDeliveryRequest): Promise<DeliveryReceipt> {
        const target = {
            id: request.routeId,
            workspaceId: request.workspaceId,
            channel: request.channel,
            externalId: request.userId,
            connectionId: request.channel === "website" ? null : request.accountId,
        }
        const result = await this.attemptSend(target, {
            workspaceId: request.workspaceId,
            conversationId: request.routeId,
            messageId: request.sendKey,
            text: request.text,
            windowChecked: request.windowChecked ?? false,
            ...(request.images === undefined || request.images.length === 0 ? {} : { images: request.images }),
        })
        if (result.failure === "channel_plan") await this.planNotice.planBlocked(target)
        if (result.delivered && target.connectionId !== null) await this.planNotice.recovered(target)
        return result
    }

    /** Shows "typing" in the customer's chat while the AI works; only Telegram has it, and a failure here never stops the reply. */
    async showTyping(target: ChannelTarget): Promise<void> {
        if (target.channel !== "telegram" || target.externalId === null || target.connectionId === null) return
        const token = await this.secrets.botToken(target.workspaceId, target.connectionId)
        if (token.kind === "ok") await this.telegram.sendTyping(token.value, customerIdOf(target.externalId))
    }

    /** The customer's name on the channel, or an empty text when the channel will not say (only Zalo is asked). The name only labels the conversation. */
    customerName(target: ChannelTarget): Promise<string> {
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
     * Sends one text to a person outside any conversation (a message to a staff member): a Telegram chat through the workspace's
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

    /** Sends the reply; a failure becomes a receipt, except a busy Zalo refresh, which is rethrown. */
    private async attemptSend(target: ChannelTarget, request: DeliveryRequest): Promise<DeliveryReceipt> {
        try {
            return await this.send(target, request)
        } catch (cause) {
            if (cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy) throw cause
            return this.failed(target, cause)
        }
    }

    private async send(target: ChannelTarget, request: DeliveryRequest): Promise<DeliveryReceipt> {
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
        return this.sendTelegram(target, target.externalId, request)
    }

    private async sendTelegram(
        target: ChannelTarget,
        externalId: string,
        request: DeliveryRequest,
    ): Promise<DeliveryReceipt> {
        if (target.connectionId === null) return NOT_DELIVERED
        const token = await this.secrets.botToken(target.workspaceId, target.connectionId)
        if (token.kind !== "ok") return NOT_DELIVERED
        const chatId = customerIdOf(externalId)
        return this.telegram.sendMessage(token.value, chatId, request.text).then(
            async () => {
                await this.pictures.send(target, token.value, chatId, withQrPicture(request.text, request.images ?? []))
                return DELIVERED
            },
            (cause: unknown) => this.failed(target, cause),
        )
    }

    private failed(target: ChannelTarget, cause: unknown): DeliveryReceipt {
        this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
            conversationId: target.id,
            channel: target.channel,
            ...deliveryFailureFieldsOf(cause),
        })
        return cause instanceof TelegramError && cause.code === TelegramErrorCode.Rejected ? NOT_DELIVERED : UNKNOWN
    }
}
