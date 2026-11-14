import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { BOOKING_RULE_DEFAULTS } from "../../rules/booking/booking"

/** The one key the booking settings of a workspace are saved under. */
export const BOOKING_SETTINGS_KEY = "booking"

type SettingsFields = {
    readonly key: FieldDef<"enum", false>
    readonly slotStepMin: FieldDef<"int", false>
    readonly minLeadMin: FieldDef<"int", false>
    readonly maxAdvanceDays: FieldDef<"int", false>
    readonly remindHoursBefore: FieldDef<"int", false>
}

const settingsFields: SettingsFields = {
    key: field.enum({ of: [BOOKING_SETTINGS_KEY], default: { literal: BOOKING_SETTINGS_KEY } }),
    slotStepMin: field.int({ default: { literal: BOOKING_RULE_DEFAULTS.slotStepMin } }),
    minLeadMin: field.int({ default: { literal: BOOKING_RULE_DEFAULTS.minLeadMin } }),
    maxAdvanceDays: field.int({ default: { literal: BOOKING_RULE_DEFAULTS.maxAdvanceDays } }),
    remindHoursBefore: field.int({ default: { literal: BOOKING_RULE_DEFAULTS.remindHoursBefore } }),
}

/**
 * The rules of the booking calendar a workspace chose: the step between start times, how soon and how far ahead a customer may book,
 * and how many hours before the start the one reminder goes out. One record per workspace. Graph node kind `booking-settings`.
 */
export const bookingSettingsEntity: EntityDefinition<SettingsFields> = defineEntity({
    name: "blocks-core.booking.settings",
    dataKind: "booking-settings",
    fields: settingsFields,
    indexes: [{ name: "key", on: ["key", "id"] }],
    constraints: [{ kind: "unique", name: "booking_key", on: ["key"], refusal: "settings-exist" }],
})
