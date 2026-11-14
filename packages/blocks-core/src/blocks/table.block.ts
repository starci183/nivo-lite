import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { CELL_FORMATS, type CellFormat } from "../rows/cell-format"
import { CELL_TONES } from "../rows/table-rows"
import { ITEMS_MAX, PATH_MAX } from "./bounds"
import { currencyCode } from "./currency-prop"
import { labelsProp, type LabelsSchema } from "./labels-prop"
import { paramName, type ParamNameSchema } from "./param-name"
import type { EnumSchema, OptionalAction, OptionalRead, RequiredRead, TextSchema } from "./schema-types"

/** Where the cells of a column line up. */
export const TABLE_ALIGNS = ["start", "end"] as const

/** Whether a column stays in the row on a narrow screen (high) or folds into the first column's cell (low). */
export const TABLE_PRIORITIES = ["high", "low"] as const

/** How wide a column is (Grammar 0.37.3): the rest of the row, its content on one line, or px. */
export const TABLE_WIDTHS = ["fill", "fit"] as const

/** The width under which a column leaves the table: a tablet (768) or a desktop (1280). */
export const TABLE_HIDE_BELOW = ["tablet", "desktop"] as const

/** The widest a fixed column is, in px. */
const COLUMN_PX_MAX = 800

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
    width: z.ZodOptional<z.ZodUnion<readonly [EnumSchema<(typeof TABLE_WIDTHS)[number]>, z.ZodNumber]>>
    minWidth: z.ZodOptional<z.ZodNumber>
    truncate: z.ZodOptional<z.ZodBoolean>
    hideBelow: z.ZodOptional<EnumSchema<(typeof TABLE_HIDE_BELOW)[number]>>
    subPath: z.ZodOptional<z.ZodString>
    tones: z.ZodOptional<z.ZodRecord<z.ZodString, EnumSchema<(typeof CELL_TONES)[number]>>>
}>

const column: ColumnSchema = z.object({
    term: specText,
    path: z.string().max(PATH_MAX),
    format: z.enum(CELL_FORMATS).optional(),
    align: z.enum(TABLE_ALIGNS).optional(),
    priority: z.enum(TABLE_PRIORITIES).optional(),
    width: z.union([z.enum(TABLE_WIDTHS), z.number().int().min(1).max(COLUMN_PX_MAX)]).optional(),
    minWidth: z.number().int().min(1).max(COLUMN_PX_MAX).optional(),
    truncate: z.boolean().optional(),
    hideBelow: z.enum(TABLE_HIDE_BELOW).optional(),
    subPath: z.string().max(PATH_MAX).optional(),
    tones: z
        .record(z.string().max(VALUE_MAX), z.enum(CELL_TONES))
        .refine((tones) => Object.keys(tones).length <= TONES_MAX)
        .optional(),
})

/** The value a filter of the table takes, written to the URL; the all choice never takes it. */
const FILTER_VALUE_MAX = 64

/** The rows a page of the table shows at most. */
const PAGE_SIZE_MAX = 100

/** One choice of the status filter above the table: the value the param takes and its words. */
type FilterSchema = z.ZodObject<{ value: z.ZodString; label: TextSchema; isAttention: z.ZodOptional<z.ZodBoolean> }>

const filter: FilterSchema = z.object({
    value: z.string().min(1).max(FILTER_VALUE_MAX),
    label: specText,
    isAttention: z.boolean().optional(),
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
    title: z.ZodOptional<TextSchema>
    search: z.ZodOptional<z.ZodBoolean>
    searchLabel: z.ZodOptional<TextSchema>
    filterParam: z.ZodOptional<ParamNameSchema>
    filterLabel: z.ZodOptional<TextSchema>
    filterAll: z.ZodOptional<TextSchema>
    filters: z.ZodOptional<z.ZodArray<FilterSchema>>
    pageSize: z.ZodOptional<z.ZodNumber>
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
    title: specText.optional(),
    search: z.boolean().optional(),
    searchLabel: specText.optional(),
    filterParam: paramName.optional(),
    filterLabel: specText.optional(),
    filterAll: specText.optional(),
    filters: z.array(filter).min(1).max(ITEMS_MAX).optional(),
    pageSize: z.number().int().min(1).max(PAGE_SIZE_MAX).optional(),
})
/** The slots of the table block: the rows read and the action a row may run. */
type Slots = {
    readonly rows: RequiredRead<"list">
    /** How many rows each status of the filter holds, under the same search: the count chips of the filter tabs. */
    readonly counts: OptionalRead<"record">
    readonly open: OptionalAction
}
const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    counts: { kind: "read", shape: "record", required: false },
    open: { kind: "action", required: false },
}

/**
 * Records compared across columns: with `search` (and a `searchParam`) a search field above the table; with `filterParam`, `filterAll` and
 * `filters` a status choice; with `pageSize` a pagination footer once the rows pass one page. Each column names its term, the path of its value and how the value is drawn. With a
 * `searchParam` its empty state says the search found nothing and offers to clear it.
 */
export const tableBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.table",
    title: { key: "blockTable" },
    props,
    slots,
    children: false,
    params: ["selectParam", "searchParam", "filterParam"],
})
