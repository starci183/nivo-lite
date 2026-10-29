import { builder } from "@starci/jest-preset"
import { bookingWaitlistEntities } from "@modules/domain/booking-waitlist"

const [BookingWaitlistEntity] = bookingWaitlistEntities
type BookingWaitlistEntity = InstanceType<typeof BookingWaitlistEntity>

const waitlistRowOf = builder<BookingWaitlistEntity>({
    id: "w-0",
    workspaceId: "ws-1",
    leadId: null,
    conversationId: null,
    customerName: "Lan",
    customerPhone: null,
    serviceId: "s-1",
    resourceId: null,
    windowStart: new Date("2026-10-20T09:00:00.000Z"),
    windowEnd: new Date("2026-10-20T12:00:00.000Z"),
    partySize: 1,
    status: "waiting",
    notifiedAt: null,
    note: "",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** A customer still waiting for a window. */
export const waitingWaitlistRow = (id: string) => waitlistRowOf({ id, status: "waiting" })
