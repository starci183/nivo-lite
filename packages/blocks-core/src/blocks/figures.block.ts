import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { FIGURE_FORMATS, FIGURE_KINDS, FIGURE_VARIANTS } from "../rows/figure-format"
import type { FigureFormat, FigureKind, FigureVariant } from "../rows/figure-format"
import { ITEMS_MAX, PATH_MAX } from "./bounds"
import { currencyCode } from "./currency-prop"
import type { EnumSchema, TextSchema, RequiredRead } from "./schema-types"

type ItemSchema = z.ZodObject<{
    term: TextSchema
    path: z.ZodString
    format: z.ZodOptional<EnumSchema<FigureFormat>>
    hintPath: z.ZodOptional<z.ZodString>
}>

const item: ItemSchema = z.object({
    term: specText,
    path: z.string().max(PATH_MAX),
    format: z.enum(FIGURE_FORMATS).optional(),
    hintPath: z.string().max(PATH_MAX).optional(),
})

const props: z.ZodObject<{
    label: TextSchema
    currency: z.ZodOptional<z.ZodString>
    kind: z.ZodOptional<EnumSchema<FigureKind>>
    variant: z.ZodOptional<EnumSchema<FigureVariant>>
    captionPath: z.ZodOptional<z.ZodString>
    items: z.ZodArray<ItemSchema>
}> = z.object({
    label: specText,
    currency: currencyCode.optional(),
    kind: z.enum(FIGURE_KINDS).optional(),
    variant: z.enum(FIGURE_VARIANTS).optional(),
    captionPath: z.string().max(PATH_MAX).optional(),
    items: z.array(item).max(ITEMS_MAX),
})
/** The slots of the figures block. */
type Slots = {
    readonly data: RequiredRead<"record">
}
const slots: Slots = { data: { kind: "read", shape: "record", required: true } }

/**
 * A strip of figures (kind `tiles`, the default; with `variant` `ribbon` one surface holds them side by side with thin dividers), bars on one scale (`bars`) or one gauge per item sharing the total
 * (`proportion`), with the text at `captionPath` under a chart: each item names its term, the path of its value in the bound record and how the value is drawn and, with a `hintPath`, the path of the line of text under it (tiles only). That value is a plain string, or a message `{ key, values }` that the block
 * translates in the words of the spec's module and fills with its `values` (reads return keys and values, never text).
 */
export const figuresBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.figures",
    title: { key: "blockFigures" },
    props,
    slots,
    children: false,
})
