import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type {
    ChannelTarget,
    DeliveryReceipt,
    DeliveryRequest,
    DeliveryResult,
    PersonDeliveryRequest,
    PersonMessage,
} from "./channels.contracts"
import { ChannelPlanNoticeService } from "./channel-plan-notice.service"
import { customerIdOf } from "./customer-id.policy"
import { deliveryFailureFieldsOf } from "./delivery-failure-fields.policy"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import { CustomerSendRegistryService } from "./customer-send-registry.service"

const DELIVERED: DeliveryReceipt = { delivered: true, failure: null, outcome: "acknowledged" }
const NOT_DELIVERED: DeliveryReceipt = { delivered: false, failure: null, outcome: "rejected" }
const UNKNOWN: DeliveryReceipt = { delivered: false, failure: null, outcome: "ambiguous" }
const ZALO_NOT_CONNECTED: DeliveryResult = { delivered: false, failure: "zalo_not_connected", outcome: "rejected" }

@Injectable()
/**
 * Pushes one message to the customer's real channel, for the one customer send: it reads and writes no conversation record, the engine's
 * delivery ledger fences each send key around it. EVERY channel call of an account (the customer send, the person's name, a staff text,
 * "typing") goes through the port `CustomerSendRegistryService.portFor(account)` answers, THE ONE SWITCH between live and sandbox: a live
 * account reaches the provider's real route, a sandbox account its sandbox twin, never the live one. This service holds no channel client
 * of its own. A failure becomes a receipt, never a throw, except a busy Zalo token refresh, which the caller settles and retries.
 */
export class ChannelDeliveryService {
    constructor(
        private readonly planNotice: ChannelPlanNoticeService,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly connections: ConnectionsService,
        private readonly customerSends: CustomerSendRegistryService,
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

    /** Shows "typing" in the customer's chat while the AI works, through the port of the account (only Telegram has it); a failure here never stops the reply. */
    async showTyping(target: ChannelTarget): Promise<void> {
        if (target.externalId === null || target.connectionId === null) return
        const account = await this.connections.find(target.workspaceId, target.connectionId)
        const port = account === null ? undefined : this.customerSends.portFor(account)
        if (account !== null) await port?.showTyping?.(account, customerIdOf(target.externalId))
    }

    /**
     * The customer's name on the channel through the port of the account, or an empty text when the channel will not say (only Zalo is
     * asked). The name only labels the conversation.
     */
    async customerName(target: ChannelTarget): Promise<string> {
        if (target.externalId === null || target.connectionId === null) return ""
        try {
            const account = await this.connections.find(target.workspaceId, target.connectionId)
            const port = account === null ? undefined : this.customerSends.portFor(account)
            if (account === null || port?.nameOf === undefined) return ""
            return await port.nameOf(account, customerIdOf(target.externalId))
        } catch (cause) {
            this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, { conversationId: target.id, channel: target.channel })
            return ""
        }
    }

    /**
     * Sends one text to a person outside any conversation (a message to a staff member) through the port of the account: a Telegram chat
     * through the workspace's bot on that connection, or a Zalo user through the OA (a rejected token is refreshed once). Throws when it
     * did not go out, so the caller records the failure; a connection that is gone, or whose provider has no staff channel, is
     * "connection not found". No 48-hour window applies, the person is staff, not a customer.
     */
    async sendToPerson(request: PersonMessage): Promise<void> {
        const account = await this.connections.find(request.workspaceId, request.connectionId)
        const port = account === null ? undefined : this.customerSends.portFor(account)
        if (account === null || port?.sendToPerson === undefined) throw new ChannelsError({ code: ChannelsErrorCode.ConnectionNotFound })
        await port.sendToPerson(account, request)
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
        const result = await this.sendOnAccount(target, request)
        return { ...result, outcome: result.outcome ?? (result.delivered ? "acknowledged" : "ambiguous") }
    }

    /**
     * The send of an ACCOUNT: the registry's `portFor(account)` is the one switch, so a live account takes the provider's live route and a
     * sandbox account its sandbox twin (never the provider). A connection that is gone, or whose provider has no send, is not connected
     * (Zalo says so in its own failure word).
     */
    private async sendOnAccount(target: ChannelTarget, request: DeliveryRequest): Promise<DeliveryResult> {
        const account = target.connectionId === null ? null : await this.connections.find(target.workspaceId, target.connectionId)
        const port = account === null ? undefined : this.customerSends.portFor(account)
        if (account === null || port === undefined) return target.channel === "zalo" ? ZALO_NOT_CONNECTED : NOT_DELIVERED
        const userId = target.externalId === null ? null : customerIdOf(target.externalId)
        return port.send(account, target, userId, { ...request, at: this.clock.now() })
    }

    private failed(target: ChannelTarget, cause: unknown): DeliveryReceipt {
        this.logger.error(ChannelsLogEvent.DeliveryFailed, cause, {
            conversationId: target.id,
            channel: target.channel,
            ...deliveryFailureFieldsOf(cause),
        })
        return UNKNOWN
    }
}
