import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { SALES_LEDGER_SETTINGS_ENTITY } from "../../../shared/entities/sales-entity-names"

/** How a voided invoice that was posted is treated in the books. */
export const VOID_MODE_VALUES: readonly [string, ...Array<string>] = ["reversal", "none"]

/** How often the shop files value added tax. */
export const VAT_PERIOD_VALUES: readonly [string, ...Array<string>] = ["monthly", "quarterly"]

/** The one row every workspace has: the key its settings are found by. */
export const SETTINGS_KEY = "workspace"

type SettingsFields = {
    readonly scope: FieldDef<"text", false>
    readonly postExpenses: FieldDef<"bool", false>
    readonly postOutgoing: FieldDef<"bool", false>
    readonly postUnmatched: FieldDef<"bool", false>
    readonly voidMode: FieldDef<"enum", false>
    readonly vatPeriod: FieldDef<"enum", false>
    readonly rematchDays: FieldDef<"int", false>
}

const settingsFields: SettingsFields = {
    scope: field.text({ maxLength: 40 }),
    postExpenses: field.bool({ default: { literal: true } }),
    postOutgoing: field.bool({ default: { literal: true } }),
    postUnmatched: field.bool({ default: { literal: false } }),
    voidMode: field.enum({ of: VOID_MODE_VALUES, default: { literal: "reversal" } }),
    vatPeriod: field.enum({ of: VAT_PERIOD_VALUES, default: { literal: "quarterly" } }),
    rematchDays: field.int({ default: { literal: 7 } }),
}

/** What a workspace decides about its books: which money and documents become entries, and how it files value added tax. One row. */
export const salesLedgerSettingsEntity: EntityDefinition<SettingsFields> = defineEntity({
    name: SALES_LEDGER_SETTINGS_ENTITY,
    dataKind: "accounting-settings",
    fields: settingsFields,
    indexes: [{ name: "scope", on: ["scope", "id"] }],
    constraints: [{ kind: "unique", name: "scope_key", on: ["scope"], refusal: "settings-exist" }],
})
