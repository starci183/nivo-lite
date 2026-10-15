import { Injectable } from "@nestjs/common"
import { BookingNoticesService } from "@modules/domain/bookings"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { textOf } from "./performer.policy"
import { LIVE_BOOKING_STATUSES } from "./booking-remind.policy"

@Injectable()
/**
 * `remind_booking`: the reminder text is already in the proposal draft (the fixed wording, or the owner's own), so sending it is all this
 * performer does. A booking that closed or started meanwhile is not reminded; the notice goes where every booking notice goes.
 */
export class BookingRemindPerformerService implements WorkPerformer {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly kit: PerformerKitService,
        private readonly notices: BookingNoticesService,
    ) {}

    /** The proposal is preset by the reminder tick. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Sends the reminder of the booking the item names. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const bookingId = textOf(proposal.fields.booking_id)
        const booking = bookingId === "" ? null : await this.notices.bookingOf(ctx.workspaceId, bookingId)
        if (booking === null) throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        if (!LIVE_BOOKING_STATUSES.includes(booking.status) || booking.start_ms <= this.clock.now().getTime()) {
            return { summary: this.kit.text(ctx, "reminderClosed"), evidence: "captured", lead_id: item.lead_id }
        }
        const text = proposal.draft ?? ""
        if (text === "") throw new WorkPerformersError({ code: WorkPerformersErrorCode.ReminderEmpty })
        const sent = await this.notices.deliver({
            workspaceId: ctx.workspaceId,
            bookingId,
            kind: "reminder",
            leadId: booking.lead_id,
            conversationId: booking.conversation_id,
            email: booking.customer_email,
            subject: this.notices.subjectOf("reminder", booking.service_name),
            text,
            dedupeKey: `remind:${item.id}`,
            workItemId: item.id,
        })
        const settings = await this.notices.settingsOf(ctx.workspaceId)
        const told = this.kit.text(ctx, sent.delivered ? "reminderSent" : "reminderNoChannel", { via: sent.via })
        return {
            summary: this.kit.text(ctx, "reminderDone", {
                name: booking.customer_name || this.kit.text(ctx, "reminderCustomer"),
                when: this.notices.whenOf(booking.start_ms, settings.timezone),
                told,
            }),
            evidence: "captured",
            lead_id: item.lead_id,
            detail: text,
        }
    }
}
