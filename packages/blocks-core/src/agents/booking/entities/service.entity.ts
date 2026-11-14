import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_LINE } from "../../../shared/bounds"
import { RESOURCE_KINDS } from "../rules/booking"

type ServiceFields = {
    readonly name: FieldDef<"text", false>
    readonly durationMin: FieldDef<"int", false>
    readonly bufferMin: FieldDef<"int", false>
    readonly priceVnd: FieldDef<"money_vnd", false>
    readonly resourceKind: FieldDef<"enum", true>
    readonly active: FieldDef<"bool", false>
    readonly note: FieldDef<"text", false>
}

const serviceFields: ServiceFields = {
    name: field.text({ maxLength: MAX_LINE, searchable: true }),
    durationMin: field.int({ default: { literal: 60 } }),
    bufferMin: field.int({ default: { literal: 0 } }),
    priceVnd: field.moneyVnd({ default: { literal: 0 } }),
    resourceKind: field.enum({ of: RESOURCE_KINDS, nullable: true }),
    active: field.bool({ default: { literal: true } }),
    note: field.text({ maxLength: 2_000, default: "empty" }),
}

/**
 * A service a customer books: its name, how long a visit lasts (and the rest after it, while the resource stays blocked), its price and,
 * when it needs one, the kind of resource (a person or a room). Graph node kind `booking-service`.
 */
export const bookingServiceEntity: EntityDefinition<ServiceFields> = defineEntity({
    name: "blocks-core.booking.service",
    dataKind: "booking-service",
    fields: serviceFields,
    indexes: [
        { name: "name", on: ["name", "id"] },
        { name: "active_name", on: ["active", "name", "id"] },
    ],
})
