import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { MAX_ID, MAX_LINE } from "../../bounds"

/** The one key the brand kit of a workspace is saved under. */
export const VIDEO_BRAND_KIT_KEY = "video"

/** The longest colour text kept (`#rrggbb`). */
const COLOR_MAX = 7

type BrandKitFields = {
    readonly key: FieldDef<"enum", false>
    readonly shopName: FieldDef<"text", false>
    readonly primaryColor: FieldDef<"text", true>
    readonly secondaryColor: FieldDef<"text", true>
    readonly voiceId: FieldDef<"text", true>
}

const brandKitFields: BrandKitFields = {
    key: field.enum({ of: [VIDEO_BRAND_KIT_KEY], default: { literal: VIDEO_BRAND_KIT_KEY } }),
    shopName: field.text({ maxLength: MAX_LINE, default: "empty" }),
    primaryColor: field.text({ maxLength: COLOR_MAX, nullable: true }),
    secondaryColor: field.text({ maxLength: COLOR_MAX, nullable: true }),
    voiceId: field.text({ maxLength: MAX_ID, nullable: true }),
}

/**
 * The video brand of a workspace: one record (the key is the same for every write, so the unique constraint holds the one row). The
 * name of the shop the script is written for, the two brand colours and the voice the speech account reads with (the provider's voice
 * id). The workspace logo is no part of it: it is a workspace setting every module reads. Graph node kind `video-brand-kit`.
 */
export const videoBrandKitEntity: EntityDefinition<BrandKitFields> = defineEntity({
    name: "blocks-core.video.brand-kit",
    dataKind: "video-brand-kit",
    fields: brandKitFields,
    indexes: [{ name: "key_id", on: ["key", "id"] }],
    constraints: [{ kind: "unique", name: "brand_key", on: ["key"], refusal: "brand-kit-exists" }],
})
