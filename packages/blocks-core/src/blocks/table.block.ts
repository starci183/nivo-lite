import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { CELL_FORMATS } from "../rows/cell-format"
import type { CellFormat } from "../rows/cell-format"
import { CELL_TONES } from "../rows/table-rows"
import { PATH_MAX } from "./bounds"
import { currencyCode } from "./currency-prop"
import { labelsProp } from "./labels-prop"
import type { LabelsSchema } from "./labels-prop"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { EnumSchema, OptionalAction, RequiredRead, TextSchema } from "./schema-types"

/** Where the cells of a column line up. */
export const TABLE_ALIGNS = ["start", "end"] as const

/** Whether a column stays in the row on a narrow screen (high) or folds into the first column's cell (low). */
export const TABLE_PRIORITIES = ["high", "low"] as const

/** The longest value a tone is given for, and the most values one column gives a tone. */
const VALUE_MAX = 64
const TONES_MAX = 20

/** The most columns one table draws. */
export const TABLE_COLUMNS_MAX = 12

type ColumnSchema = z.ZodObject<{
    term: TextSchema
    path: z.ZodString
    format: z.ZodOptional<EnumSchema<CellFormat>>
    align: z.ZodOptional<EnumSchema<(typeof TABLE_ALIGNS)[number]>>
    priority: z.ZodOptional<EnumSchema<(typeof TABLE_PRIORITIES)[number]>>
    subPath: z.ZodOptional<z.ZodString>
    tones: z.ZodOptional<z.ZodRecord<z.ZodString, EnumSchema<(typeof CELL_TONES)[number]>>>
}>

const column: ColumnSchema = z.object({
    term: specText,
    path: z.string().max(PATH_MAX),
    format: z.enum(CELL_FORMATS).optional(),
    align: z.enum(TABLE_ALIGNS).optional(),
    priority: z.enum(TABLE_PRIORITIES).optional(),
    subPath: z.string().max(PATH_MAX).optional(),
    tones: z
        .record(z.string().max(VALUE_MAX), z.enum(CELL_TONES))
        .refine((tones) => Object.keys(tones).length <= TONES_MAX)
        .optional(),
})

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    idPath: z.ZodString
    columns: z.ZodArray<ColumnSchema>
    currency: z.ZodOptional<z.ZodString>
    labels: z.ZodOptional<LabelsSchema>
    selectParam: z.ZodOptional<ParamNameSchema>
    searchParam: z.ZodOptional<ParamNameSchema>
    emptySearch: z.ZodOptional<TextSchema>
}> = z.object({
    label: specText,
    empty: specText,
    idPath: z.string().max(PATH_MAX),
    columns: z.array(column).min(1).max(TABLE_COLUMNS_MAX),
    currency: currencyCode.optional(),
    labels: labelsProp.optional(),
    selectParam: paramName.optional(),
    searchParam: paramName.optional(),
    emptySearch: specText.optional(),
})
/** The slots of the table block: the rows read and the action a row may run. */
type Slots = {
    readonly rows: RequiredRead<"list">
    readonly open: OptionalAction
}
const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    open: { kind: "action", required: false },
}

/**
 * Records compared across columns: each column names its term, the path of its value and how the value is drawn. With a
 * `searchParam` its empty state says the search found nothing and offers to clear it.
 */
export const tableBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.table",
    title: { key: "blockTable" },
    props,
    slots,
    children: false,
    params: ["selectParam", "searchParam"],
})
