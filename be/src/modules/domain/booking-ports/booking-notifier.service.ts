import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import type { BookingsModule } from "@modules/domain/bookings"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { EventsService } from "@modules/domain/events"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"

/** The notifier contract of the booking capability's required class option. */
type BookingNotifier = InstanceType<Parameters<typeof BookingsModule.register>[0]["notifier"]>
/** The notice accepted by the booking capability's notifier. */
type BookingNotice = Parameters<BookingNotifier["notify"]>[0]

const LOCALE = "vi"

@Injectable()
/** Carries booking notices through the same stored-message and channel delivery capabilities as customer replies. */
export class BookingNotifierService implements BookingNotifier {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly channels: ChannelDeliveryService,
        private readonly events: EventsService,
    ) {}

    /** Stores and delivers a notice only in its workspace, then records the actual delivery result. */
    async notify(notice: BookingNotice): Promise<boolean> {
        const target = await this.conversations.targetOf(notice.conversationId)
        if (target.kind !== "ok") {
            await this.record(notice, false, "none")
            return false
        }
        if (target.value.workspaceId !== notice.workspaceId) return false
        const messageId = await this.messages.storeAgentMessage(notice.workspaceId, notice.conversationId, notice.text)
        const { delivered } = await this.channels.deliver({
            conversationId: notice.conversationId,
            messageId,
            text: notice.text,
        })
        await this.record(notice, delivered, target.value.channel)
        return delivered
    }

    private async record(notice: BookingNotice, delivered: boolean, channel: string): Promise<void> {
        await this.events.record({
            workspaceId: notice.workspaceId,
            kind: "booking.notified",
            actor: this.catalog.get("bookings.evidence.actor", {}, LOCALE),
            summary: this.catalog.get(
                delivered ? "bookingPorts.delivered" : "bookingPorts.failed",
                { channel },
                LOCALE,
            ),
            evidence: notice.text,
        })
    }
}
