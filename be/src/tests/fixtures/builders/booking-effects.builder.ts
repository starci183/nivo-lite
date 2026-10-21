import { builder } from "@starci/jest-preset"
import type { EventsService } from "@modules/domain/events"
import type { BookingNotice, BookingNoticesService, EffectsRow } from "@modules/domain/bookings"
type NoticeFacts = Awaited<ReturnType<BookingNoticesService["factsOf"]>>

const BOOKING_ID = "b1"
const WORKSPACE = "ws-1"
const START = Date.UTC(2026, 9, 15, 2, 30)

export const noticeOf = builder<BookingNotice>({
    workspaceId: WORKSPACE,
    bookingId: BOOKING_ID,
    kind: "confirmed",
    leadId: "lead-1",
    conversationId: "conversation-1",
    email: "mai@example.com",
    subject: "Notice subject",
    text: "Notice text",
    dedupeKey: `${BOOKING_ID}:notice:confirmed`,
})
export const FACTS: NoticeFacts = {
    shop: "Shop",
    customer: "Mai",
    service: "Cut",
    resource: "An",
    startMs: START,
    timezone: "Asia/Ho_Chi_Minh",
    address: "1 Main Street",
    depositVnd: 50_000,
    cancelWindowHours: 24,
    fromMs: null,
    feeVnd: 0,
}
export const rowOf = builder<EffectsRow>({
    id: BOOKING_ID,
    workspace_id: WORKSPACE,
    status: "confirmed",
    lead_id: "lead-1",
    conversation_id: "conversation-1",
    customer_name: "Mai",
    customer_phone: "84912345678",
    customer_email: "mai@example.com",
    cancel_reason: null,
    reschedule_count: 0,
    service_name: "Cut",
    price_vnd: 200000,
    cancel_fee_vnd: 0,
    start_ms: START,
    cancelled_ms: null,
    resource_name: "An",
    deposit_vnd: 50_000,
    from_ms: null,
    holds_slot: true,
})
export const evidenceOf = builder<Parameters<EventsService["record"]>[0]>({
    workspaceId: WORKSPACE,
    kind: "booking.done",
    actor: "vi:bookings.evidence.actor:{}",
    summary: 'vi:bookings.evidence.done:{"service":"Cut","customer":"Mai"}',
    leadId: "lead-1",
})
