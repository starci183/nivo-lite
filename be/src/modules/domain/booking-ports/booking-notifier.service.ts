import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import type { BookingNotice, BookingNoticeResult, BookingNotifier } from "@modules/domain/bookings"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { EventsService } from "@modules/domain/events"
import { InjectN8nMailer } from "@modules/domain/n8n-runs"
import type { N8nMailer } from "@modules/domain/n8n-runs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BookingPortsLogEvent } from "./booking-ports.log-events"

const LOCALE = "vi"

/** The conversation a notice goes into. */
interface Destination {
    readonly id: string
    readonly channel: string
}

/** A notice that reached nobody: nothing was stored, so repeating the attempt is safe. */
const NOWHERE: BookingNoticeResult = { delivered: false, kept: false, via: "none" }

@Injectable()
/**
 * Carries a booking notice to the customer the way the old booking performers did: into the conversation the booking came from, else
 * the customer's latest conversation, else by email through the owner's gate. Whatever the outcome, the evidence log gets a
 * `booking.notified` line on the customer's timeline.
 */
export class BookingNotifierService implements BookingNotifier {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @InjectN8nMailer() private readonly mailer: N8nMailer,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
        private readonly channels: ChannelDeliveryService,
        private readonly events: EventsService,
    ) {}

    /** Delivers one notice and records what became of it. */
    async notify(notice: BookingNotice): Promise<BookingNoticeResult> {
        const destination = await this.destinationOf(notice)
        const result =
            destination === null ? await this.byEmail(notice) : await this.inConversation(notice, destination)
        await this.record(notice, result)
        return result
    }

    private async destinationOf(notice: BookingNotice): Promise<Destination | null> {
        if (notice.conversationId !== null) {
            const target = await this.conversations.targetOf(notice.conversationId)
            if (target.kind === "ok" && target.value.workspaceId === notice.workspaceId) {
                return { id: notice.conversationId, channel: target.value.channel }
            }
        }
        if (notice.leadId === null) return null
        const latest = await this.conversations.latestOfLead(notice.workspaceId, notice.leadId, null)
        return latest === null ? null : { id: latest.id, channel: latest.channel }
    }

    private async inConversation(notice: BookingNotice, destination: Destination): Promise<BookingNoticeResult> {
        const messageId = await this.messages.storeAgentMessage(notice.workspaceId, destination.id, notice.text)
        const delivered = await this.channels
            .deliver({ conversationId: destination.id, messageId, text: notice.text })
            .then(
                (outcome) => outcome.delivered,
                (cause: unknown) => {
                    this.logger.error(BookingPortsLogEvent.DeliveryFailed, cause, {
                        workspaceId: notice.workspaceId,
                        bookingId: notice.bookingId,
                    })
                    return false
                },
            )
        return { delivered, kept: true, via: destination.channel }
    }

    private async byEmail(notice: BookingNotice): Promise<BookingNoticeResult> {
        const to = notice.email?.trim() ?? ""
        if (to === "") return NOWHERE
        const outcome = await this.mailer.requestCustomerEmail({
            workspaceId: notice.workspaceId,
            to,
            subject: notice.subject,
            body: notice.text,
            purpose: "booking",
            refs: { booking_id: notice.bookingId },
            dedupeKey: `booking_notice:${notice.dedupeKey}`,
            subjectType: "lead",
            subjectId: notice.leadId,
            leadId: notice.leadId,
        })
        const queued = outcome.status === "waiting_decision" || outcome.status === "duplicate"
        return { delivered: outcome.status === "sent", kept: outcome.status === "sent" || queued, via: "email" }
    }

    private async record(notice: BookingNotice, result: BookingNoticeResult): Promise<void> {
        try {
            await this.events.record({
                workspaceId: notice.workspaceId,
                kind: "booking.notified",
                actor: this.catalog.get("bookings.evidence.actor", {}, LOCALE),
                summary: this.catalog.get(
                    result.delivered ? "bookingPorts.delivered" : "bookingPorts.failed",
                    { channel: result.via },
                    LOCALE,
                ),
                evidence: notice.text,
                leadId: notice.leadId,
                workItemId: notice.workItemId ?? null,
            })
        } catch (cause) {
            this.logger.error(BookingPortsLogEvent.EvidenceFailed, cause, {
                workspaceId: notice.workspaceId,
                bookingId: notice.bookingId,
            })
        }
    }
}
