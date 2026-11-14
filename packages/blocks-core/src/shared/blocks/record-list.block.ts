import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { CELL_TONES } from "../rows/table-rows"
import { CHIPS_MAX, PATH_MAX } from "./bounds"
import { labelsProp, type LabelsSchema } from "./labels-prop"
import { paramName, type ParamNameSchema } from "./param-name"
import type { EnumSchema, TextSchema, RequiredRead, OptionalAction } from "./schema-types"

/** The longest raw value a badge is given a tone for, and the most values one badge gives a tone. */
const TONE_VALUE_MAX = 64
const TONES_MAX = 20

type FooterLinkSchema = z.ZodObject<{ label: TextSchema; path: z.ZodString }>

/** A link under the rows of a card: its words and the path it opens, an app path or one relative to the page (`./work`). */
const footerLink: FooterLinkSchema = z.object({ label: specText, path: z.string().min(1).max(PATH_MAX) })

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    idPath: z.ZodString
    titlePath: z.ZodString
    descriptionPath: z.ZodOptional<z.ZodString>
    badgePath: z.ZodOptional<z.ZodString>
    metaPath: z.ZodOptional<z.ZodString>
    chipPaths: z.ZodOptional<z.ZodArray<z.ZodString>>
    logoPath: z.ZodOptional<z.ZodString>
    badgeTones: z.ZodOptional<z.ZodRecord<z.ZodString, EnumSchema<(typeof CELL_TONES)[number]>>>
    avatar: z.ZodOptional<z.ZodBoolean>
    surface: z.ZodOptional<z.ZodEnum<{ plain: "plain"; card: "card" }>>
    labels: z.ZodOptional<LabelsSchema>
    emptySearch: z.ZodOptional<TextSchema>
    selectParam: z.ZodOptional<ParamNameSchema>
    searchParam: z.ZodOptional<ParamNameSchema>
    footerLink: z.ZodOptional<FooterLinkSchema>
}> = z.object({
    label: specText,
    empty: specText,
    idPath: z.string().max(PATH_MAX),
    titlePath: z.string().max(PATH_MAX),
    descriptionPath: z.string().max(PATH_MAX).optional(),
    badgePath: z.string().max(PATH_MAX).optional(),
    metaPath: z.string().max(PATH_MAX).optional(),
    chipPaths: z.array(z.string().max(PATH_MAX)).max(CHIPS_MAX).optional(),
    logoPath: z.string().max(PATH_MAX).optional(),
    badgeTones: z
        .record(z.string().max(TONE_VALUE_MAX), z.enum(CELL_TONES))
        .refine((tones) => Object.keys(tones).length <= TONES_MAX)
        .optional(),
    avatar: z.boolean().optional(),
    surface: z.enum(["plain", "card"]).optional(),
    labels: labelsProp.optional(),
    emptySearch: specText.optional(),
    selectParam: paramName.optional(),
    searchParam: paramName.optional(),
    footerLink: footerLink.optional(),
})
/** The slots of the record list block: the rows read and the action a row may run. */
type Slots = {
    readonly rows: RequiredRead<"list">
    readonly open: OptionalAction
}
const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    open: { kind: "action", required: false },
}

/**
 * Bound records as a card (with `surface` `card`, ONE surface holds the rows, which the tinted page shows around) with an optional action on each row; with a `selectParam` a selectable list that writes the chosen row
 * to the param, marks the row the param names and loads further pages on request. With a `searchParam` its empty state says
 * the search found nothing and offers to clear it.
 */
export const recordListBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.record-list",
    title: { key: "blockRecordList" },
    params: ["selectParam", "searchParam"],
    props,
    slots,
    children: false,
})
