import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_BODY, MAX_LINE } from "../../bounds"
import { MAX_REASON_CHARS } from "../../rules/sales/stage"

/** The channels a customer reaches the business through. */
export const LEAD_CHANNELS: readonly [string, ...Array<string>] = [
    "telegram",
    "zalo",
    "facebook",
    "instagram",
    "website",
]

/** The stages a lead moves through. */
export const LEAD_STAGES: readonly [string, ...Array<string>] = ["new", "qualified", "proposal", "won", "lost"]

type LeadFields = {
    readonly contactName: FieldDef<"text", false>
    readonly company: FieldDef<"text", true>
    readonly channel: FieldDef<"enum", false>
    readonly need: FieldDef<"text", true>
    readonly stage: FieldDef<"enum", false>
    readonly contextSummary: FieldDef<"text", true>
    readonly closedReason: FieldDef<"text", true>
    readonly phone: FieldDef<"text", true>
    readonly email: FieldDef<"text", true>
}

const leadFields: LeadFields = {
    contactName: field.text({ maxLength: MAX_LINE, searchable: true }),
    company: field.text({ maxLength: MAX_LINE, searchable: true, nullable: true }),
    channel: field.enum({ of: LEAD_CHANNELS, default: { literal: "website" } }),
    need: field.text({ maxLength: MAX_BODY, searchable: true, nullable: true }),
    stage: field.enum({ of: LEAD_STAGES, default: { literal: "new" } }),
    contextSummary: field.text({ maxLength: MAX_BODY, nullable: true }),
    closedReason: field.text({ maxLength: MAX_REASON_CHARS, nullable: true }),
    phone: field.text({ maxLength: 30, searchable: true, nullable: true }),
    email: field.text({ maxLength: MAX_LINE, searchable: true, nullable: true }),
}

/** One customer of a workspace. Graph node kind `sales-lead`. */
export const leadEntity: EntityDefinition<LeadFields> = defineEntity({
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: leadFields,
    indexes: [
        { name: "recent", on: [{ desc: "updatedAt" }, { desc: "id" }] },
        { name: "stage_recent", on: ["stage", { desc: "updatedAt" }, { desc: "id" }] },
        { name: "name", on: ["contactName", "id"] },
        { name: "stage_name", on: ["stage", "contactName", "id"] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "phone_key",
            on: ["phone"],
            where: { op: "notNull", field: "phone" },
            refusal: "phone-taken",
        },
        {
            kind: "unique",
            name: "email_key",
            on: ["email"],
            where: { op: "notNull", field: "email" },
            refusal: "email-taken",
        },
    ],
    matchKeys: [
        { name: "phone", on: ["phone"] },
        { name: "email", on: ["email"] },
    ],
})
