import { Injectable } from "@nestjs/common"
import { BookingDeskService } from "@modules/domain/bookings"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { textOf } from "./performer.policy"

/** The booking actions this performer runs. */
export const BOOKING_ACTIONS = ["cancel_booking", "cancel_with_fee", "confirm_booking", "reschedule"] as const

/** The default reason of a cancellation a customer asked for. */
const CUSTOMER_REASON = "customer_cancelled"

@Injectable()
/**
 * What happens once the gate lets a booking action through (by the owner's rule or after a person approved it): a cancellation the customer
 * asked for in chat, a request confirmed, a booking moved to the time the customer asked. The booking changes here and nowhere else; the
 * late-cancellation fee, the reminders and the notice to the customer follow from the status change (the booking_status job), so a repeat
 * of an action that already ran changes nothing. Only a person's approval may move a booking onto a place taken meanwhile.
 */
export class BookingPerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly desk: BookingDeskService,
    ) {}

    /** The proposal is preset by whoever asked (the chat booking tools or the chat booking request). */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Runs the action of the item on its booking. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const id = textOf(proposal.fields.booking_id)
        if (id === "") throw new WorkPerformersError({ code: WorkPerformersErrorCode.SubjectMissing })
        const ref = { workspaceId: ctx.workspaceId, id }
        const facts = {
            service: textOf(proposal.fields.service),
            name: textOf(proposal.fields.customer_name),
            start: textOf(proposal.fields.start_at),
        }
        if (item.action === "confirm_booking") {
            const change = await this.desk.confirmApproved(ref)
            const key = change.status === "confirmed" ? "bookingConfirmed" : "bookingUnchanged"
            return this.done(ctx, item, key, { ...facts, status: change.status })
        }
        if (item.action === "reschedule") {
            const startAt = textOf(proposal.fields.new_start)
            const moved = await this.desk.moveApproved({
                ...ref,
                startAt,
                resourceId: "",
                force: item.decided_path === "human",
            })
            if (!moved.ok) {
                throw new WorkPerformersError({
                    code: WorkPerformersErrorCode.BookingNotMoved,
                    params: { reason: moved.reason ?? "taken" },
                })
            }
            return this.done(ctx, item, "bookingMoved", { ...facts, start: startAt })
        }
        const reason = textOf(proposal.fields.reason).trim()
        const change = await this.desk.cancelApproved(ref, reason === "" ? CUSTOMER_REASON : reason.slice(0, 200))
        const key = change.status === "cancelled" ? "bookingCancelled" : "bookingUnchanged"
        return this.done(ctx, item, key, { ...facts, status: change.status })
    }

    private done(ctx: WorkContext, item: WorkItem, key: string, params: Readonly<Record<string, string>>): Performed {
        return { summary: this.kit.text(ctx, key, params), evidence: "captured", lead_id: item.lead_id }
    }
}
