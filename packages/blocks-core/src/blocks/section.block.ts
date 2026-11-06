import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { TextSchema } from "./schema-types"

/** The most options one sort control lists, and the longest value an option takes (it is written to the URL). */
export const SORT_OPTIONS_MAX = 10
const SORT_VALUE_MAX = 64

/** One option of the sort control: the value the param takes and its words. */
type SortOptionSchema = z.ZodObject<{ value: z.ZodString; label: TextSchema }>

const sortOption: SortOptionSchema = z.object({ value: z.string().min(1).max(SORT_VALUE_MAX), label: specText })

/** The sort control in the head of the card: a select whose chosen option is written to a spec param. */
type SortSchema = z.ZodObject<{
    param: ParamNameSchema
    label: TextSchema
    options: z.ZodArray<SortOptionSchema>
}>

const sort: SortSchema = z.object({
    param: paramName,
    label: specText,
    options: z
        .array(sortOption)
        .min(1)
        .max(SORT_OPTIONS_MAX)
        .refine((options) => new Set(options.map((option) => option.value)).size === options.length),
})

const props: z.ZodObject<{ title: TextSchema; hint: z.ZodOptional<TextSchema>; sort: z.ZodOptional<SortSchema> }> =
    z.object({
        title: specText,
        hint: specText.optional(),
        sort: sort.optional(),
    })
const slots: Record<never, never> = {}

/**
 * A titled card holding child blocks, with an optional hint over them. With `sort` (`{ param, label, options }`) the head of the
 * card carries a select, "label: chosen option", whose options the spec lists and whose choice is written to the spec param; the
 * option the param names is chosen, else the first. What the choice does is up to the reads that bind the param as a variable
 * (`"$sort"`), never to the section.
 */
export const sectionBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.section",
    title: { key: "blockSection" },
    params: ["sort.param"],
    props,
    slots,
    children: {},
})
