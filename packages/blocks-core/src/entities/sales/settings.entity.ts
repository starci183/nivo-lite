import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

/** The one key the settings record of a workspace is saved under. */
export const SALES_SETTINGS_KEY = "sales"

type SettingsFields = {
    readonly key: FieldDef<"text", false>
    readonly approvalThresholdVnd: FieldDef<"money_vnd", false>
    readonly draftWithoutTotalNeedsApproval: FieldDef<"bool", false>
    readonly closedDealsCanFlip: FieldDef<"bool", false>
    readonly reopenNeedsApproval: FieldDef<"bool", false>
}

const settingsFields: SettingsFields = {
    key: field.text({ maxLength: 20 }),
    approvalThresholdVnd: field.moneyVnd(),
    draftWithoutTotalNeedsApproval: field.bool({ default: { literal: true } }),
    closedDealsCanFlip: field.bool({ default: { literal: true } }),
    reopenNeedsApproval: field.bool({ default: { literal: true } }),
}

/** The rules a workspace chose for its sales: one record, saved under the key `sales`. Graph node kind `sales-settings`. */
export const settingsEntity: EntityDefinition<SettingsFields> = defineEntity({
    name: "sales.settings",
    dataKind: "sales-settings",
    fields: settingsFields,
    indexes: [{ name: "key", on: ["key", "id"] }],
    constraints: [{ kind: "unique", name: "key_key", on: ["key"], refusal: "settings-exist" }],
})
