import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { ITEMS_MAX, PATH_MAX } from "./bounds"
import type { OptionalRead, TextSchema } from "./schema-types"

/** The longest id of a data set: it names the data page (`data/<set>`), so it is a URL segment. */
const SET_MAX = 64

/** The id of a data set: a URL segment. */
const SET_ID = /^[a-z][a-z0-9-]*$/u

/** The most keys a count over rows names. */
const COUNT_KEYS_MAX = 20

/**
 * A count that is the sum of rows of the counts read: the list at `path`, adding each row's `value`, only the rows whose `by` member is
 * one of `keys` when given (the counts per state of a CRM, summed over the states a data page lists). Data in the spec, never code.
 */
type CountRowsSchema = z.ZodObject<{
    path: z.ZodString
    value: z.ZodString
    by: z.ZodOptional<z.ZodString>
    keys: z.ZodOptional<z.ZodArray<z.ZodString>>
}>

const countRows: CountRowsSchema = z.object({
    path: z.string().min(1).max(PATH_MAX),
    value: z.string().min(1).max(PATH_MAX),
    by: z.string().min(1).max(PATH_MAX).optional(),
    keys: z.array(z.string().min(1).max(SET_MAX)).min(1).max(COUNT_KEYS_MAX).optional(),
})

type ItemSchema = z.ZodObject<{
    set: z.ZodString
    label: TextSchema
    countPath: z.ZodOptional<z.ZodString>
    countRows: z.ZodOptional<CountRowsSchema>
    hint: z.ZodOptional<TextSchema>
    hintPath: z.ZodOptional<z.ZodString>
}>

const item: ItemSchema = z.object({
    set: z.string().min(1).max(SET_MAX).regex(SET_ID),
    label: specText,
    countPath: z.string().min(1).max(PATH_MAX).optional(),
    countRows: countRows.optional(),
    hint: specText.optional(),
    hintPath: z.string().min(1).max(PATH_MAX).optional(),
})

type Props = z.ZodObject<{
    label: TextSchema
    openLabel: TextSchema
    items: z.ZodArray<ItemSchema>
}>

const props: Props = z
    .object({
        label: specText,
        openLabel: specText,
        items: z.array(item).max(ITEMS_MAX),
    })
    .refine((value) => new Set(value.items.map((entry) => entry.set)).size === value.items.length)
    .refine((value) => value.items.every((entry) => entry.countPath === undefined || entry.countRows === undefined))

/** The slots of the data sets block: the ONE read that counts every set. */
type Slots = {
    readonly counts: OptionalRead<"record">
}
const slots: Slots = { counts: { kind: "read", shape: "record", required: false } }

/** The prefix of the id of every data page view of a module's workbench spec. */
export const DATA_VIEW_PREFIX = "data-"

/** Where the data page of a set is, beside the agent's pages: the route `agents/<module>/<installation>/data/<set>`. */
export const dataSetPathOf = (set: string): string => `./data/${set}`

/** The view of a module's workbench spec that the data page of a set draws: hidden (no tab), opened by its own route. */
export const dataSetViewOf = (set: string): string => `${DATA_VIEW_PREFIX}${set}`

/**
 * The data an agent works on, for its desk: one row per set the spec lists (its words, the count at `countPath` in the ONE `counts`
 * read (or the sum `countRows` names over a list of it), a line from `hint` with `{count}` filled from `hintPath`), each with "open" to its OWN data page (`./data/<set>`: a table and the
 * chosen record, the view `data-<set>` of the module's spec), never a tab of the desk. A count the read does not hold (or a set with no
 * `countPath`) draws no count, never 0. A spec with no item draws nothing: the card is hidden.
 */
export const dataSetsBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.data-sets",
    title: { key: "blockDataSets" },
    props,
    slots,
    children: false,
})
