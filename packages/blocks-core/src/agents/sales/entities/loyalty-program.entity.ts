import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { ZodType } from "zod"

import { MAX_LINE } from "../../../shared/bounds"
import { loyaltyConfigShape, type StoredLoyaltyConfig } from "../loyalty/rules/config.schema"
import { SALES_LOYALTY_PROGRAM_ENTITY } from "../../../shared/entities/sales-entity-names"

/** The one row every workspace has: the key its programme is found by. */
export const PROGRAM_KEY = "workspace"

/** The rules of the programme as the entity keeps them: the earning, the tier ladder, the expiry, the birthday gift and the promotion limits. */
type ProgramConfig = StoredLoyaltyConfig

type ProgramFields = {
    readonly scope: FieldDef<"text", false>
    readonly name: FieldDef<"text", false>
    readonly slug: FieldDef<"text", false>
    readonly enabled: FieldDef<"bool", false>
    readonly config: FieldDef<"jsonb", false> & { readonly shape: ZodType<ProgramConfig> }
}

const programFields: ProgramFields = {
    scope: field.text({ maxLength: 40 }),
    name: field.text({ maxLength: MAX_LINE, default: "empty" }),
    slug: field.text({ maxLength: MAX_LINE, default: "empty" }),
    enabled: field.bool({ default: { literal: false } }),
    config: field.jsonb({ shape: loyaltyConfigShape }),
}

/** The loyalty programme of a workspace: its name, the slug of the public points page and the rules, the tier ladder among them. One row. */
export const loyaltyProgramEntity: EntityDefinition<ProgramFields> = defineEntity({
    name: SALES_LOYALTY_PROGRAM_ENTITY,
    dataKind: "loyalty-program",
    fields: programFields,
    indexes: [{ name: "scope", on: ["scope", "id"] }],
    constraints: [{ kind: "unique", name: "scope_key", on: ["scope"], refusal: "program-exists" }],
})
