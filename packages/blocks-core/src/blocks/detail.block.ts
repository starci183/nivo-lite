import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { CELL_FORMATS } from "../rows/cell-format"
import type { CellFormat } from "../rows/cell-format"
import { ITEMS_MAX, PATH_MAX } from "./bounds"
import { currencyCode } from "./currency-prop"
import { labelsProp } from "./labels-prop"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { LabelsSchema } from "./labels-prop"
import { RECORD_SURFACES } from "./record-surface"
import type { EnumSchema, OptionalAction, RequiredRead, TextSchema } from "./schema-types"

/** The most titled groups of facts one detail holds. */
export const DETAIL_SECTIONS_MAX = 10

type FactSchema = z.ZodObject<{ term: TextSchema; path: z.ZodString; format: z.ZodOptional<EnumSchema<CellFormat>> }>

const fact: FactSchema = z.object({
    term: specText,
    path: z.string().max(PATH_MAX),
    format: z.enum(CELL_FORMATS).optional(),
})

type SectionSchema = z.ZodObject<{ title: z.ZodOptional<TextSchema>; items: z.ZodArray<FactSchema> }>

const section: SectionSchema = z.object({
    title: specText.optional(),
    items: z.array(fact).max(ITEMS_MAX),
})

type TimelineSchema = z.ZodObject<{
    title: TextSchema
    listPath: z.ZodString
    textPath: z.ZodString
    notePath: z.ZodOptional<z.ZodString>
    atPath: z.ZodOptional<z.ZodString>
}>

const timeline: TimelineSchema = z.object({
    title: specText,
    listPath: z.string().max(PATH_MAX),
    textPath: z.string().max(PATH_MAX),
    notePath: z.string().max(PATH_MAX).optional(),
    atPath: z.string().max(PATH_MAX).optional(),
})

const props: z.ZodObject<{
    label: TextSchema
    idle: z.ZodOptional<TextSchema>
    idPath: z.ZodOptional<z.ZodString>
    currency: z.ZodOptional<z.ZodString>
    labels: z.ZodOptional<LabelsSchema>
    items: z.ZodArray<FactSchema>
    sections: z.ZodOptional<z.ZodArray<SectionSchema>>
    titlePath: z.ZodOptional<z.ZodString>
    kind: z.ZodOptional<TextSchema>
    closeParam: z.ZodOptional<ParamNameSchema>
    timeline: z.ZodOptional<TimelineSchema>
    pinsPrimary: z.ZodOptional<z.ZodBoolean>
    primaryWhen: z.ZodOptional<z.ZodString>
    secondaryWhen: z.ZodOptional<z.ZodString>
    surface: z.ZodOptional<EnumSchema<(typeof RECORD_SURFACES)[number]>>
}> = z.object({
    label: specText,
    idle: specText.optional(),
    idPath: z.string().max(PATH_MAX).optional(),
    currency: currencyCode.optional(),
    labels: labelsProp.optional(),
    items: z.array(fact).max(ITEMS_MAX),
    sections: z.array(section).max(DETAIL_SECTIONS_MAX).optional(),
    titlePath: z.string().max(PATH_MAX).optional(),
    kind: specText.optional(),
    closeParam: paramName.optional(),
    timeline: timeline.optional(),
    pinsPrimary: z.boolean().optional(),
    primaryWhen: z.string().max(PATH_MAX).optional(),
    secondaryWhen: z.string().max(PATH_MAX).optional(),
    surface: z.enum(RECORD_SURFACES).optional(),
})
/** The slots of the detail block: the record it shows, and the two actions it may offer on that record. */
type Slots = {
    readonly record: RequiredRead<"record">
    readonly primary: OptionalAction
    readonly secondary: OptionalAction
}
const slots: Slots = {
    record: { kind: "read", shape: "record", required: true },
    primary: { kind: "action", required: false },
    secondary: { kind: "action", required: false },
}

/**
 * The facts of one bound record, in titled groups, with up to two actions on it. With `titlePath` the head names the record (its
 * title, its `kind`, and a close control that clears `closeParam`); with `timeline` a list of the record's steps is drawn as a
 * timeline; with `pinsPrimary` the primary action stands pinned at the bottom of the pane. `primaryWhen` and `secondaryWhen` name a boolean
 * field of the record: the action is offered only while the read says it is (the block holds no rule of its own).
 * With no record chosen it says so instead of failing.
 */
export const detailBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.detail",
    title: { key: "blockDetail" },
    props,
    slots,
    params: ["closeParam"],
    children: false,
})
