import { Injectable } from "@nestjs/common"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ConnectionsService } from "@modules/domain/connections"
import { InjectZalo, isZaloTokenRejection, zaloFailureOf } from "@modules/integrations/zalo"
import type { ZaloClient, ZaloFailure } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DeliveryRequest, DeliveryResult, OptionalZnsRenewal } from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { sepayQrUrlOf } from "./qr-image.policy"
import { normaliseVnPhone } from "./vn-phone.policy"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { renewalTemplateData, znsRenewalOf } from "./zns-renewal.policy"

/** Consultation messages are free for 48 hours after the customer's last interaction; later ones are paid or refused by Zalo. */
const ZALO_FREE_WINDOW_MS = 48 * 3_600_000

const BY_CONSULTATION: DeliveryResult = { delivered: true, failure: null, via: "consultation" }
const BY_ZNS: DeliveryResult = { delivered: true, failure: null, via: "zns" }

@Injectable()
/**
 * The Zalo route of a customer reply. Inside the 48-hour window the text goes as a consultation message, and a text that carries a
 * SePay QR link is followed by the QR as an image. Outside it, a structured notice reaches the customer by ZNS when the connection has
 * a ZNS template and the customer has a phone; otherwise the refusal stands with a note naming what was missing.
 */
export class ZaloDeliveryService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectLogger() private readonly logger: Logger,
        private readonly messages: AgentMessagesService,
        private readonly credentials: ZaloCredentialsService,
        private readonly connections: ConnectionsService,
    ) {}

    /**
     * Sends the reply to the customer of a Zalo conversation. A closed window, a conversation without the customer's Zalo id, or Zalo
     * itself saying the window is closed turn to ZNS when the request carries a notice. Never throws, except a busy token refresh.
     */
    async send(target: ConversationTarget, userId: string | null, request: DeliveryRequest): Promise<DeliveryResult> {
        const connectionId = target.connectionId
        if (connectionId === null) return { delivered: false, failure: "zalo_not_connected" }
        if (userId === null) return this.outsideWindow(target, connectionId, request, "zalo_not_connected")
        if (await this.windowClosed(target.id))
            return this.outsideWindow(target, connectionId, request, "zalo_window_expired")
        const { text } = request
        return this.withToken(connectionId, (token) => this.zalo.sendCsText(token, userId, text)).then(
            () => this.followWithQr(target, connectionId, userId, text),
            (cause: unknown) => {
                const failure = this.failed(target, cause)
                return failure === "zalo_window_expired"
                    ? this.outsideWindow(target, connectionId, request, failure)
                    : { delivered: false, failure }
            },
        )
    }

    /** Sends one consultation text to a Zalo user with the connection's token; throws when it did not go out. */
    async sendText(connectionId: string, userId: string, text: string): Promise<void> {
        await this.withToken(connectionId, (token) => this.zalo.sendCsText(token, userId, text))
    }

    /** True when the customer last wrote longer ago than the free window; a conversation they never wrote in is open. */
    private async windowClosed(conversationId: string): Promise<boolean> {
        const last = await this.messages.lastCustomerAt(conversationId)
        return last.kind === "ok" && this.clock.now().getTime() - last.value.getTime() > ZALO_FREE_WINDOW_MS
    }

    /** Sends the SePay QR of a delivered text as an image; the text already carries the link, so a refusal only leaves a note. */
    private followWithQr(
        target: ConversationTarget,
        connectionId: string,
        userId: string,
        text: string,
    ): Promise<DeliveryResult> {
        const qr = sepayQrUrlOf(text)
        if (qr === null) return Promise.resolve(BY_CONSULTATION)
        return this.withToken(connectionId, (token) => this.zalo.sendCsImage(token, userId, qr)).then(
            () => BY_CONSULTATION,
            (cause: unknown): DeliveryResult => {
                this.logger.warn(ChannelsLogEvent.QrImageFailed, {
                    conversationId: target.id,
                    failure: zaloFailureOf(cause),
                })
                return { ...BY_CONSULTATION, note: "qr_image_failed" }
            },
        )
    }

    /** The ZNS fallback: only with a notice, a ZNS template on the connection and a phone that reads as a Vietnamese mobile. */
    private async outsideWindow(
        target: ConversationTarget,
        connectionId: string,
        request: DeliveryRequest,
        refusal: ZaloFailure,
    ): Promise<DeliveryResult> {
        const notice = request.notification
        if (notice === undefined) return { delivered: false, failure: refusal }
        const settings = await this.znsSettingsOf(target.workspaceId, connectionId)
        const phone = normaliseVnPhone(notice.phone)
        if (settings === null || phone === null) {
            const note = settings === null ? "zns_not_configured" : "zns_no_phone"
            this.logger.warn(ChannelsLogEvent.ZnsFallbackSkipped, { conversationId: target.id, refusal, note })
            return { delivered: false, failure: refusal, note }
        }
        const message = {
            phone,
            templateId: settings.templateId,
            templateData: renewalTemplateData(settings.params, notice.fields),
            trackingId: request.messageId,
        }
        return this.withToken(connectionId, (token) => this.zalo.sendZns(token, message)).then(
            (receipt) => {
                this.logger.info(ChannelsLogEvent.ZnsSent, {
                    conversationId: target.id,
                    zaloMessageId: receipt.messageId,
                })
                return BY_ZNS
            },
            (cause: unknown): DeliveryResult => ({ delivered: false, failure: this.failed(target, cause) }),
        )
    }

    private async znsSettingsOf(workspaceId: string, connectionId: string): Promise<OptionalZnsRenewal> {
        const connection = await this.connections.find(workspaceId, connectionId)
        return connection === null ? null : znsRenewalOf(connection.meta)
    }

    /** Calls Zalo with the connection's access token; a token Zalo rejects is renewed once and the call tried again. */
    private async withToken<T>(connectionId: string, call: (token: string) => Promise<T>): Promise<T> {
        const token = await this.credentials.accessToken(connectionId)
        return call(token).catch(async (cause: unknown) => {
            if (!isZaloTokenRejection(cause)) throw cause
            return call(await this.credentials.accessToken(connectionId, { stale: token }))
        })
    }

    /** Logs a Zalo failure and names it for the workbench; a busy token refresh is thrown back so the caller retries. */
    private failed(target: ConversationTarget, cause: unknown): ZaloFailure {
        if (cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy) throw cause
        this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
            conversationId: target.id,
            channel: "zalo",
        })
        return zaloFailureOf(cause)
    }
}
