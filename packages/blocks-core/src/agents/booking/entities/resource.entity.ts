import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_LINE } from "../../../shared/bounds"
import { RESOURCE_KINDS } from "../rules/booking"

type ResourceFields = {
    readonly name: FieldDef<"text", false>
    readonly kind: FieldDef<"enum", false>
    readonly staffId: FieldDef<"uuid", true>
    readonly capacity: FieldDef<"int", false>
    readonly active: FieldDef<"bool", false>
    readonly sort: FieldDef<"int", false>
}

const resourceFields: ResourceFields = {
    name: field.text({ maxLength: MAX_LINE, searchable: true }),
    kind: field.enum({ of: RESOURCE_KINDS, default: { literal: "person" } }),
    staffId: field.uuid({ nullable: true }),
    capacity: field.int({ default: { literal: 1 } }),
    active: field.bool({ default: { literal: true } }),
    sort: field.int({ default: { literal: 0 } }),
}

/**
 * Who or what serves a booking: a person (optionally a member of the platform's staff directory, by its id) or a room, how many
 * customers it serves at once, and its order on the calendar. Graph node kind `booking-resource`.
 */
export const bookingResourceEntity: EntityDefinition<ResourceFields> = defineEntity({
    name: "blocks-core.booking.resource",
    dataKind: "booking-resource",
    fields: resourceFields,
    indexes: [
        { name: "sort", on: ["sort", "id"] },
        { name: "active_sort", on: ["active", "sort", "id"] },
    ],
})
