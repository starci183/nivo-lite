import type { ListPage } from "@nivo-lite/agent-sdk/block"
import { BOOKING_RULE_DEFAULTS } from "../../../rules/booking/booking"
import type { ModuleFixtures } from "../../module-fixtures"
import type { BookingRow, ResourceRow, ServiceRow } from "../ports"

const page = <R>(rows: ReadonlyArray<R>): ListPage<R> => ({ rows, cursor: null })

const BOOKINGS: ReadonlyArray<BookingRow> = [
    {
        id: "b1",
        customerName: "Hoa",
        customerPhone: "0901234567",
        startAt: "2026-11-16T02:00:00.000Z",
        status: "confirmed",
        partySize: 1,
        note: "",
    },
    {
        id: "b2",
        customerName: "Minh",
        customerPhone: null,
        startAt: "2026-11-16T04:00:00.000Z",
        status: "requested",
        partySize: 2,
        note: "Head spa for two",
    },
]

const SERVICES: ReadonlyArray<ServiceRow> = [
    { id: "s1", name: "Head spa", durationMin: 60, priceVnd: 150_000, active: true },
    { id: "s2", name: "Neck and shoulder massage", durationMin: 45, priceVnd: 200_000, active: true },
]

const RESOURCES: ReadonlyArray<ResourceRow> = [
    { id: "r1", name: "Lan", kind: "person", capacity: 1, active: true },
    { id: "r2", name: "Double room", kind: "room", capacity: 2, active: true },
]

/** The bookings of one contact as the contact detail draws them: the row of the Booking's own read, without the bookkeeping. */
const contactRowOf = ({ id, customerName, startAt, status, note }: BookingRow) => ({ id, customerName, startAt, status, note })

/** The fixtures of the Booking module: what the prototype data port answers for each read and action. */
export const BOOKING_FIXTURES: ModuleFixtures = {
    reads: {
        "blocks-core.booking.api.booking.list": { ready: page(BOOKINGS), empty: page([]) },
        "blocks-core.booking.api.booking.of-contact": {
            ready: { rows: BOOKINGS.map((item) => contactRowOf(item)), cursor: null },
            empty: page([]),
        },
        "blocks-core.booking.api.service.list": { ready: page(SERVICES), empty: page([]) },
        "blocks-core.booking.api.resource.list": { ready: page(RESOURCES), empty: page([]) },
        "blocks-core.booking.api.settings.get": { ready: { ...BOOKING_RULE_DEFAULTS } },
    },
    actions: {
        "blocks-core.booking.service-save": { ok: true, data: { id: "s3" } },
        "blocks-core.booking.resource-save": { ok: true, data: { id: "r3" } },
        "blocks-core.booking.booking-status-set": { ok: true, data: { id: "b2" } },
        "blocks-core.booking.hours-save": { ok: true, data: { id: "h1" } },
        "blocks-core.booking.settings-save": { ok: true, data: { id: "set1" } },
    },
}
