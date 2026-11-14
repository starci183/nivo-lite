import { Injectable } from "@nestjs/common"
import { ConnectionSecretReadsService, type ConnectionRecord } from "@modules/domain/connections"
import { InjectTelegram, TelegramError, TelegramErrorCode, type TelegramClient } from "@modules/integrations/telegram"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { ChannelTarget, DeliveryResult, PersonMessage } from "./channels.contracts"
import type { CustomerSendPort, CustomerSendRequest } from "./customer-send-ports.contracts"
import { deliveryFailureFieldsOf } from "./delivery-failure-fields.policy"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { withQrPicture } from "./qr-image.policy"
import { TelegramPicturesService } from "./telegram-pictures.service"

/** The receipt of a send Telegram (or the bot) refused: a definite refusal before acceptance. */
const NOT_DELIVERED: DeliveryResult = { delivered: false, failure: null, outcome: "rejected" }

/** The receipt of a send whose outcome is not known (Telegram did not answer). */
const UNKNOWN: DeliveryResult = { delivered: false, failure: null, outcome: "ambiguous" }

/** The receipt of a send Telegram accepted. */
const DELIVERED: DeliveryResult = { delivered: true, failure: null, outcome: "acknowledged" }

@Injectable()
/**
 * The LIVE Telegram customer send: the text goes through the bot of the account (its token read from the connection secret), the pictures
 * follow as photos or one album, exactly as the engine always sent them. A refusal is an answer, never a throw: Telegram's explicit refusal
 * (a blocked bot) is a definite `rejected` receipt, anything else (no answer) an unknown outcome. It also sends a staff text and shows
 * "typing". The registry reaches it only for a live account.
 */
export class TelegramCustomerSendService implements CustomerSendPort {
    readonly provider = "telegram"

    constructor(
        private readonly secrets: ConnectionSecretReadsService,
        private readonly pictures: TelegramPicturesService,
        @InjectTelegram() private readonly telegram: TelegramClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Sends the text, then the pictures, to the chat of the person with the account's bot; a person with no id, or an account whose bot is gone, is a refusal. */
    async send(
        account: ConnectionRecord,
        target: ChannelTarget,
        userId: string | null,
        request: CustomerSendRequest,
    ): Promise<DeliveryResult> {
        if (userId === null) return NOT_DELIVERED
        const token = await this.secrets.botToken(account.workspaceId, account.id)
        if (token.kind !== "ok") return NOT_DELIVERED
        return this.telegram.sendMessage(token.value, userId, request.text).then(
            async () => {
                await this.pictures.send(target, token.value, userId, withQrPicture(request.text, request.images ?? []))
                return DELIVERED
            },
            (cause: unknown) => this.failed(target, cause),
        )
    }

    /** Sends one text to a Telegram chat through the workspace's bot on that connection; throws when it did not go out. */
    async sendToPerson(_account: ConnectionRecord, request: PersonMessage): Promise<void> {
        const token = await this.secrets.botToken(request.workspaceId, request.connectionId)
        if (token.kind !== "ok") throw new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
        await this.telegram.sendMessage(token.value, request.recipientId, request.text)
    }

    /** Shows "typing" in the chat of the person while the AI works; nothing when the bot is gone. */
    async showTyping(account: ConnectionRecord, personId: string): Promise<void> {
        const token = await this.secrets.botToken(account.workspaceId, account.id)
        if (token.kind === "ok") await this.telegram.sendTyping(token.value, personId)
    }

    /** Logs a failed send and answers its receipt: Telegram's explicit refusal is `rejected`, anything else unknown. */
    private failed(target: ChannelTarget, cause: unknown): DeliveryResult {
        this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
            conversationId: target.id,
            channel: target.channel,
            ...deliveryFailureFieldsOf(cause),
        })
        return cause instanceof TelegramError && cause.code === TelegramErrorCode.Rejected ? NOT_DELIVERED : UNKNOWN
    }
}
