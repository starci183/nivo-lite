import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { ALL_TAB } from "../rows/filter-tabs"
import { CELL_TONES } from "../rows/table-rows"
import { CHIPS_MAX, ITEMS_MAX, PATH_MAX } from "./bounds"
import { labelsProp } from "./labels-prop"
import type { LabelsSchema } from "./labels-prop"
import { paramName } from "./param-name"
import type { ParamNameSchema } from "./param-name"
import type { EnumSchema, OptionalRead, RequiredRead, TextSchema } from "./schema-types"

/** The longest raw value a badge is given a tone for, and the most values one badge gives a tone. */
const TONE_VALUE_MAX = 64
const TONES_MAX = 20

/** The longest value a filter takes: it is written to the URL. */
const FILTER_VALUE_MAX = 64

/** One filter tab: the value the param takes, its words, and whether rows with it wait for the viewer. */
type FilterSchema = z.ZodObject<{ value: z.ZodString; label: TextSchema; attention: z.ZodOptional<z.ZodBoolean> }>

const filter: FilterSchema = z.object({
    value: z.string().min(1).max(FILTER_VALUE_MAX),
    label: specText,
    attention: z.boolean().optional(),
})

type Props = z.ZodObject<{
    label: TextSchema
    title: z.ZodOptional<TextSchema>
    empty: TextSchema
    emptySearch: z.ZodOptional<TextSchema>
    idPath: z.ZodString
    titlePath: z.ZodString
    descriptionPath: z.ZodOptional<z.ZodString>
    badgePath: z.ZodOptional<z.ZodString>
    metaPath: z.ZodOptional<z.ZodString>
    chipPaths: z.ZodOptional<z.ZodArray<z.ZodString>>
    badgeTones: z.ZodOptional<z.ZodRecord<z.ZodString, EnumSchema<(typeof CELL_TONES)[number]>>>
    avatar: z.ZodOptional<z.ZodBoolean>
    labels: z.ZodOptional<LabelsSchema>
    selectParam: ParamNameSchema
    search: z.ZodBoolean
    searchParam: z.ZodOptional<ParamNameSchema>
    searchLabel: z.ZodOptional<TextSchema>
    filterParam: z.ZodOptional<ParamNameSchema>
    filterLabel: z.ZodOptional<TextSchema>
    filterAll: z.ZodOptional<TextSchema>
    filters: z.ZodOptional<z.ZodArray<FilterSchema>>
}>

const props: Props = z
    .object({
        label: specText,
        title: specText.optional(),
        empty: specText,
        emptySearch: specText.optional(),
        idPath: z.string().max(PATH_MAX),
        titlePath: z.string().max(PATH_MAX),
        descriptionPath: z.string().max(PATH_MAX).optional(),
        badgePath: z.string().max(PATH_MAX).optional(),
        metaPath: z.string().max(PATH_MAX).optional(),
        chipPaths: z.array(z.string().max(PATH_MAX)).max(CHIPS_MAX).optional(),
        badgeTones: z
            .record(z.string().max(TONE_VALUE_MAX), z.enum(CELL_TONES))
            .refine((tones) => Object.keys(tones).length <= TONES_MAX)
            .optional(),
        avatar: z.boolean().optional(),
        labels: labelsProp.optional(),
        selectParam: paramName,
        search: z.boolean(),
        searchParam: paramName.optional(),
        searchLabel: specText.optional(),
        filterParam: paramName.optional(),
        filterLabel: specText.optional(),
        filterAll: specText.optional(),
        filters: z.array(filter).min(1).max(ITEMS_MAX).optional(),
    })
    .refine((value) => !value.search || value.searchParam !== undefined)
    .refine((value) =>
        value.filterParam === undefined
            ? value.filters === undefined && value.filterAll === undefined
            : value.filters !== undefined && value.filterAll !== undefined,
    )
    .refine(
        (value) =>
            value.filters === undefined ||
            (new Set(value.filters.map((item) => item.value)).size === value.filters.length &&
                value.filters.every((item) => item.value !== ALL_TAB)),
    )

/** The slots of the list card: the counts of the filter (when it has one) and the rows. */
type Slots = {
    readonly counts: OptionalRead<"record">
    readonly rows: RequiredRead<"list">
}
const slots: Slots = {
    counts: { kind: "read", shape: "record", required: false },
    rows: { kind: "read", shape: "list", required: true },
}

/**
 * A list of records as ONE card: its header holds the filter tabs (each with its count, from the `counts` read) and the search field on
 * one line, then the rows under it, one of which the `selectParam` marks and a press writes; further pages load from a footer. The
 * card owns its states: loading, empty, nothing found, failed and forbidden draw inside it with the header kept.
 */
export const listCardBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.list-card",
    title: { key: "blockListCard" },
    params: ["selectParam", "searchParam", "filterParam"],
    props,
    slots,
    children: false,
})
