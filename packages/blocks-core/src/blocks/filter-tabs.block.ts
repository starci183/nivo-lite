import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { ITEMS_MAX } from "./bounds"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { OptionalRead } from "./form.block"
import type { TextSchema, RequiredRead } from "./schema-types"
import { ALL_TAB } from "../rows/filter-tabs"

/** The longest value a filter takes: it is written to the URL. */
const VALUE_MAX = 64

/** One filter tab: the value the param takes, its words, and whether rows with it wait for the viewer. */
type TabSchema = z.ZodObject<{ value: z.ZodString; label: TextSchema; attention: z.ZodOptional<z.ZodBoolean> }>

const tab: TabSchema = z.object({
    value: z.string().min(1).max(VALUE_MAX),
    label: specText,
    attention: z.boolean().optional(),
})

const props: z.ZodObject<{
    param: ParamNameSchema
    label: z.ZodOptional<TextSchema>
    all: TextSchema
    items: z.ZodOptional<z.ZodArray<TabSchema>>
}> = z.object({
    param: paramName,
    label: specText.optional(),
    all: specText,
    items: z
        .array(tab)
        .max(ITEMS_MAX)
        .refine(
            (items) =>
                new Set(items.map((item) => item.value)).size === items.length &&
                items.every((item) => item.value !== ALL_TAB),
        )
        .optional(),
})
/** The slots of the filter tabs: the counts of every filter value under the same search, and optionally the tabs themselves. */
type Slots = {
    readonly counts: RequiredRead<"record">
    readonly items: OptionalRead<"list">
}
const slots: Slots = {
    counts: { kind: "read", shape: "record", required: true },
    items: { kind: "read", shape: "list", required: false },
}

/**
 * Underline tabs that narrow a list through a param; each tab shows how many rows it holds, read from the counts. The tabs are the
 * literal `items` of the spec, or, when the spec leaves `items` out, the rows of the bound `items` read: `{ value, label, count?,
 * attention? }` with the label as text or as a message `{ key, values }`, so a tab set that is data (the tiers of a programme)
 * follows the data. A count of the counts read wins over the count of a row; the literal `items` win when both are given.
 */
export const filterTabsBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.filter-tabs",
    title: { key: "blockFilterTabs" },
    params: ["param"],
    props,
    slots,
    children: false,
})
