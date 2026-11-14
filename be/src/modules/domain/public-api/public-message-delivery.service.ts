import { Injectable } from "@nestjs/common"
import { ChannelDeliveryService, ChannelsError, ChannelsErrorCode, RECIPIENT_NOT_LINKED } from "@modules/domain/channels"
import { ContactsService } from "@modules/domain/contacts"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { PendingMessageDelivery } from "./public-api.contracts"

/** The reason a delivery row keeps when the provider's own busy answer stopped the attempt before anything went out. */
const CHANNEL_BUSY = "channel_busy"

@Injectable()
/**
 * Sends an API message to the person of its route, after the request's transaction committed: one row of the engine's delivery ledger
 * claimed under the send key (`api.message:<request id>`) before the provider is asked and settled after, so the same request never sends
 * twice (a delivered or uncertain key answers its earlier outcome and sends nothing; only a definite refusal is tried again). The person's
 * id on the channel is read from the contact's own channel identity; a person with none is a refusal row, not a send. No chat line is stored.
 */
export class PublicMessageDeliveryService {
    constructor(
        private readonly deliveries: ChannelDeliveriesService,
        private readonly channels: ChannelDeliveryService,
        private readonly contacts: ContactsService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Claims the send key and sends once; a busy Zalo token refresh is the one failure thrown (the claim is settled refused so a retry sends). */
    async send(pending: PendingMessageDelivery): Promise<void> {
        const { workspaceId, sendKey } = pending
        const claimed = await this.deliveries.claim(workspaceId, {
            sendKey,
            routeId: pending.routeId,
            contactId: pending.contactId,
            agentId: pending.agentId,
            runId: null,
            stepKey: null,
            text: pending.text,
            attachmentCount: 0,
            attachmentKinds: [],
            channel: pending.channel,
            accountId: pending.accountId,
        })
        if (claimed.verdict !== "send") return
        const userId = await this.userIdOf(pending)
        if (userId === null) {
            await this.deliveries.mark(workspaceId, sendKey, { state: "refused", reason: RECIPIENT_NOT_LINKED })
            return
        }
        const receipt = await this.channels
            .deliverToPerson({
                workspaceId,
                routeId: pending.routeId,
                channel: pending.channel,
                accountId: pending.accountId,
                userId,
                sendKey,
                text: pending.text,
            })
            .catch(async (cause: unknown) => {
                if (cause instanceof ChannelsError && cause.code === ChannelsErrorCode.ZaloRefreshBusy)
                    await this.deliveries.mark(workspaceId, sendKey, { state: "refused", reason: CHANNEL_BUSY })
                throw cause
            })
        if (receipt.delivered) {
            await this.deliveries.mark(workspaceId, sendKey, { state: "delivered", providerMessageId: null, at: this.clock.now() })
        } else if (receipt.outcome !== "rejected") {
            await this.deliveries.mark(workspaceId, sendKey, { state: "unknown", reason: null })
        } else {
            await this.deliveries.mark(workspaceId, sendKey, { state: "refused", reason: receipt.failure ?? "delivery_rejected" })
        }
    }

    /** The person's own id on the route's channel and account: the value of their channel identity there; null when they hold none. */
    private async userIdOf(pending: PendingMessageDelivery): Promise<string | null> {
        const person = await this.contacts.get(pending.workspaceId, pending.contactId)
        return (
            person?.identities.find(
                (identity) =>
                    identity.kind === "channel" && identity.provider === pending.channel && identity.account === (pending.accountId ?? ""),
            )?.value ?? null
        )
    }
}
