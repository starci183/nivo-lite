import { defineRecordQuery, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { bookingEntity } from "../../../entities/booking/booking.entity"
import { BOOKING_VIEW } from "../constants"

/** The most bookings one read answers for a contact: the contact detail shows the first rows, the calendar holds the rest. */
export const CONTACT_BOOKINGS_PAGE = 5

/** The fields of a booking the contact detail draws; nothing of the record's bookkeeping. */
const CONTACT_BOOKING_FIELDS = ["customerName", "startAt", "status", "partySize", "note"] as const

/** The text member of a record's data, or empty. */
const textOf = (row: RecordRow, key: string): string => {
    const value = row.data[key]
    return typeof value === "string" ? value : ""
}

/** The booking as the contact detail draws it: who it was booked under, when, where it stands and what was asked beside the service. */
const contactBookingOf = (row: RecordRow): unknown => ({
    id: row.id,
    customerName: textOf(row, "customerName"),
    startAt: textOf(row, "startAt"),
    status: textOf(row, "status"),
    note: textOf(row, "note"),
})

/**
 * The bookings of ONE contact (the Booking's own records, the latest visit first): the read behind the Booking's block on the contact
 * detail. The contact id follows a merge, so a person merged from two contacts shows the bookings of both.
 */
export const CONTACT_BOOKINGS: ReadDefinition = defineRecordQuery({
    id: "blocks-core.booking.api.booking.of-contact",
    dataKind: "booking",
    shape: "list",
    fields: ["rows"],
    paths: { rows: "list" },
    permission: BOOKING_VIEW,
    variables: z.object({ contactId: z.string().min(1).max(MAX_ID) }),
    type: bookingEntity,
    view: contactBookingOf,
    list: ({ contactId }) => ({
        select: CONTACT_BOOKING_FIELDS,
        where: q.eq("contactId", contactId),
        order: [
            ["startAt", "desc"],
            ["id", "desc"],
        ],
        page: { size: CONTACT_BOOKINGS_PAGE },
    }),
})
