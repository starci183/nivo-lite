import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { CELL_FORMATS } from "../rows/cell-format"
import type { CellFormat } from "../rows/cell-format"
import { ITEMS_MAX, PATH_MAX } from "./bounds"
import { currencyCode } from "./currency-prop"
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

const props: z.ZodObject<{
    label: TextSchema
    idle: z.ZodOptional<TextSchema>
    idPath: z.ZodOptional<z.ZodString>
    currency: z.ZodOptional<z.ZodString>
    items: z.ZodArray<FactSchema>
    sections: z.ZodOptional<z.ZodArray<SectionSchema>>
}> = z.object({
    label: specText,
    idle: specText.optional(),
    idPath: z.string().max(PATH_MAX).optional(),
    currency: currencyCode.optional(),
    items: z.array(fact).max(ITEMS_MAX),
    sections: z.array(section).max(DETAIL_SECTIONS_MAX).optional(),
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

/** The facts of one bound record, in titled groups, with up to two actions on it; with no record chosen it says so instead of failing. */
export const detailBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.detail",
    title: { key: "blockDetail" },
    props,
    slots,
    children: false,
})
