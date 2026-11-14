import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { ZodType } from "zod"
import { MAX_LINE } from "../../bounds"
import { brandCadenceShape, brandPillarsShape, type BrandCadence, type BrandPillars } from "../../rules/content/brand"

/** The one key the content brand of a workspace is saved under. */
export const CONTENT_BRAND_KEY = "content"

/** The longest voice, limits or audience text kept. */
export const BRAND_TEXT_MAX = 2_000

type BrandFields = {
    readonly key: FieldDef<"enum", false>
    readonly voice: FieldDef<"text", false>
    readonly avoid: FieldDef<"text", false>
    readonly audience: FieldDef<"text", false>
    readonly cta: FieldDef<"text", false>
    readonly hashtags: FieldDef<"text", false>
    readonly pillars: FieldDef<"jsonb", false> & { readonly shape: ZodType<BrandPillars> }
    readonly cadence: FieldDef<"jsonb", false> & { readonly shape: ZodType<BrandCadence> }
}

const brandFields: BrandFields = {
    key: field.enum({ of: [CONTENT_BRAND_KEY], default: { literal: CONTENT_BRAND_KEY } }),
    voice: field.text({ maxLength: BRAND_TEXT_MAX, default: "empty" }),
    avoid: field.text({ maxLength: BRAND_TEXT_MAX, default: "empty" }),
    audience: field.text({ maxLength: BRAND_TEXT_MAX, default: "empty" }),
    cta: field.text({ maxLength: MAX_LINE, default: "empty" }),
    hashtags: field.text({ maxLength: MAX_LINE, default: "empty" }),
    pillars: field.jsonb({ shape: brandPillarsShape }),
    cadence: field.jsonb({ shape: brandCadenceShape }),
}

/**
 * The content brand of a workspace: one record (the key is the same for every write, so the unique constraint holds the one row). The
 * voice the posts are written in, what they never say, who they speak to, the call to action and the brand's hashtags; the content
 * themes (pillars, each with its weight) and the posting rhythm of each channel (cadence). The brand guideline PDF is a document of the
 * Second Brain, read by the nodes through the brain search. Graph node kind `content-brand`.
 */
export const contentBrandEntity: EntityDefinition<BrandFields> = defineEntity({
    name: "blocks-core.content.brand",
    dataKind: "content-brand",
    fields: brandFields,
    indexes: [{ name: "key_id", on: ["key", "id"] }],
    constraints: [{ kind: "unique", name: "brand_key", on: ["key"], refusal: "brand-exists" }],
})
