import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { ITEMS_MAX, PATH_MAX } from "./bounds"
import { labelsProp } from "./labels-prop"
import type { LabelsSchema } from "./labels-prop"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { OptionalAction, RequiredRead, TextSchema } from "./schema-types"

/** The longest value a column holds: it is the value of a field. */
const VALUE_MAX = 64

/** One column: the value of the grouping field it holds and its words. */
type ColumnSchema = z.ZodObject<{ value: z.ZodString; label: TextSchema }>

const column: ColumnSchema = z.object({ value: z.string().min(1).max(VALUE_MAX), label: specText })

const props: z.ZodObject<{
    label: TextSchema
    emptyColumn: TextSchema
    emptySearch: z.ZodOptional<TextSchema>
    idPath: z.ZodString
    titlePath: z.ZodString
    groupBy: z.ZodString
    columns: z.ZodArray<ColumnSchema>
    descriptionPath: z.ZodOptional<z.ZodString>
    badgePath: z.ZodOptional<z.ZodString>
    metaPath: z.ZodOptional<z.ZodString>
    labels: z.ZodOptional<LabelsSchema>
    selectParam: z.ZodOptional<ParamNameSchema>
    searchParam: z.ZodOptional<ParamNameSchema>
}> = z.object({
    label: specText,
    emptyColumn: specText,
    emptySearch: specText.optional(),
    idPath: z.string().max(PATH_MAX),
    titlePath: z.string().max(PATH_MAX),
    groupBy: z.string().max(PATH_MAX),
    columns: z
        .array(column)
        .min(1)
        .max(ITEMS_MAX)
        .refine((columns) => new Set(columns.map((item) => item.value)).size === columns.length),
    descriptionPath: z.string().max(PATH_MAX).optional(),
    badgePath: z.string().max(PATH_MAX).optional(),
    metaPath: z.string().max(PATH_MAX).optional(),
    labels: labelsProp.optional(),
    selectParam: paramName.optional(),
    searchParam: paramName.optional(),
})
/** The slots of the board: the cards read, and the action that moves a card to another column. */
type Slots = {
    readonly rows: RequiredRead<"list">
    readonly move: OptionalAction
}
const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    move: { kind: "action", required: false },
}

/**
 * Records in the columns a field's declared values name, side by side. A card moves by drag or by keyboard: the move shows at
 * once and runs the `move` action with the card's id and the column in the value `to`; a refusal puts the card back. Pressing a
 * card writes its id to the `selectParam`. With a `searchParam` the empty state says the search found nothing. On a phone one
 * column shows at a time and the others scroll into view.
 */
export const boardBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.board",
    title: { key: "blockBoard" },
    params: ["selectParam", "searchParam"],
    props,
    slots,
    children: false,
})
