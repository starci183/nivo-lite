import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { FIGURE_FORMATS } from "../rows/figure-format"
import type { FigureFormat } from "../rows/figure-format"
import { ITEMS_MAX, PATH_MAX } from "./bounds"
import { currencyCode } from "./currency-prop"
import type { EnumSchema, TextSchema, RequiredRead } from "./schema-types"

type ItemSchema = z.ZodObject<{
    term: TextSchema
    path: z.ZodString
    format: z.ZodOptional<EnumSchema<FigureFormat>>
}>

const item: ItemSchema = z.object({
    term: specText,
    path: z.string().max(PATH_MAX),
    format: z.enum(FIGURE_FORMATS).optional(),
})

const props: z.ZodObject<{
    label: TextSchema
    currency: z.ZodOptional<z.ZodString>
    items: z.ZodArray<ItemSchema>
}> = z.object({
    label: specText,
    currency: currencyCode.optional(),
    items: z.array(item).max(ITEMS_MAX),
})
/** The slots of the figures block. */
type Slots = {
    readonly data: RequiredRead<"record">
}
const slots: Slots = { data: { kind: "read", shape: "record", required: true } }

/** A ribbon of figures in one card: each item names its term, the path of its value in the bound record and how the value is drawn. */
export const figuresBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.figures",
    title: { key: "blockFigures" },
    props,
    slots,
    children: false,
})
