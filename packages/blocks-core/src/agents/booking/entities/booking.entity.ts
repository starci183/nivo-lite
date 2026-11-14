import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { BOOKING_STATUSES } from "../rules/booking"

type BookingFields = {
    readonly customerName: FieldDef<"text", false>
    readonly customerPhone: FieldDef<"text", true>
    readonly customerEmail: FieldDef<"text", true>
    readonly contactId: FieldDef<"contact", true>
    readonly conversationId: FieldDef<"text", true>
    readonly serviceId: FieldDef<"uuid", false>
    readonly resourceId: FieldDef<"uuid", false>
    readonly startAt: FieldDef<"timestamptz", false>
    readonly endAt: FieldDef<"timestamptz", false>
    readonly blockEndAt: FieldDef<"timestamptz", false>
    readonly partySize: FieldDef<"int", false>
    readonly status: FieldDef<"enum", false>
    readonly note: FieldDef<"text", false>
    readonly remindedAt: FieldDef<"timestamptz", true>
}

const bookingFields: BookingFields = {
    customerName: field.text({ maxLength: MAX_LINE, searchable: true }),
    customerPhone: field.text({ maxLength: 40, nullable: true }),
    customerEmail: field.text({ maxLength: MAX_LINE, nullable: true }),
    contactId: field.contact({ nullable: true, onContactDelete: "clear" }),
    conversationId: field.text({ maxLength: MAX_ID, nullable: true }),
    serviceId: field.uuid(),
    resourceId: field.uuid(),
    startAt: field.timestamptz(),
    endAt: field.timestamptz(),
    blockEndAt: field.timestamptz(),
    partySize: field.int({ default: { literal: 1 } }),
    status: field.enum({ of: BOOKING_STATUSES, default: { literal: "requested" } }),
    note: field.text({ maxLength: 2_000, default: "empty" }),
    remindedAt: field.timestamptz({ nullable: true }),
}

/**
 * One booking: who booked (the customer's name and phone as the shop noted them, `contactId` the core contact when the booking came by a
 * conversation, and the conversation it came from), the service and the
 * resource, the start, the end of the visit and the end of its rest (`blockEndAt`: the resource is free again), the party, the status
 * (`requested`, `confirmed`, `done`, or `cancelled`), a note and when its one reminder went out. Graph node kind `booking`.
 */
export const bookingEntity: EntityDefinition<BookingFields> = defineEntity({
    name: "blocks-core.booking.booking",
    dataKind: "booking",
    fields: bookingFields,
    indexes: [
        { name: "start", on: ["startAt", "id"] },
        { name: "status_start", on: ["status", "startAt", "id"] },
        { name: "contact_start", on: ["contactId", { desc: "startAt" }, { desc: "id" }] },
    ],
})
