import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName } from "../param-name"
import type { ParamNameSchema } from "../param-name"
import type { RequiredRead, TextSchema } from "../schema-types"

const props: z.ZodObject<{
    title: TextSchema
    searchLabel: TextSchema
    empty: TextSchema
    emptySearch: TextSchema
    searchParam: ParamNameSchema
    filterParam: ParamNameSchema
    selectParam: ParamNameSchema
    periodParam: ParamNameSchema
    paneParam: ParamNameSchema
}> = z.object({
    title: specText,
    searchLabel: specText,
    empty: specText,
    emptySearch: specText,
    searchParam: paramName,
    filterParam: paramName,
    selectParam: paramName,
    periodParam: paramName,
    paneParam: paramName,
})

/** The slots of the book: the entries it lists and the counts of each status under the same search. */
type Slots = {
    readonly rows: RequiredRead<"list">
    readonly counts: RequiredRead<"record">
}
const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    counts: { kind: "read", shape: "record", required: true },
}

/**
 * The books of the shop: a head with the period and how many entries it holds, a search, the status tabs with their counts, and the
 * entries as rows of a day, two lines, an amount in dong and a status mark. Choosing a row writes its id to `selectParam` and opens the aside pane (`paneParam` takes `detail`).
 */
export const accountingBookBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "accounting.book",
    title: { key: "blockAccountingBook" },
    props,
    slots,
    children: false,
    params: ["searchParam", "filterParam", "selectParam", "periodParam", "paneParam"],
})
