import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName, type ParamNameSchema } from "../param-name"
import type { OptionalRead, RequiredRead, TextSchema } from "../schema-types"

const props: z.ZodObject<{
    label: TextSchema
    searchLabel: TextSchema
    all: TextSchema
    atRisk: TextSchema
    sortLabel: TextSchema
    empty: TextSchema
    emptySearch: z.ZodOptional<TextSchema>
    showAtRisk: z.ZodOptional<z.ZodBoolean>
    searchParam: ParamNameSchema
    tierParam: ParamNameSchema
    activityParam: ParamNameSchema
    sortParam: ParamNameSchema
    selectParam: ParamNameSchema
}> = z.object({
    label: specText,
    searchLabel: specText,
    all: specText,
    atRisk: specText,
    sortLabel: specText,
    empty: specText,
    emptySearch: specText.optional(),
    showAtRisk: z.boolean().optional(),
    searchParam: paramName,
    tierParam: paramName,
    activityParam: paramName,
    sortParam: paramName,
    selectParam: paramName,
})

/** The slots of the members list: the members, the tiers of the ladder, and the counts the tabs show. */
type Slots = {
    readonly rows: RequiredRead<"list">
    readonly tiers: RequiredRead<"list">
    readonly tierCounts: RequiredRead<"record">
    readonly activityCounts: OptionalRead<"record">
}

const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    tiers: { kind: "read", shape: "list", required: true },
    tierCounts: { kind: "read", shape: "record", required: true },
    activityCounts: { kind: "read", shape: "record", required: false },
}

/**
 * The members of the loyalty programme: a head with the number of members and the sort, a search, one tab for each tier of the ladder
 * (read from `loyalty.tiers`, so a ladder the owner renamed shows its own names) with the members who have gone quiet after them, and
 * the members as rows with their tier, points and last purchase. A tab writes the tier or the activity to its param, the sort writes
 * the sort param, pressing a row writes the member to `selectParam`; the spec binds those params to the variables of the members read.
 */
export const loyaltyMembersBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "loyalty.members",
    title: { key: "block_members" },
    params: ["searchParam", "tierParam", "activityParam", "sortParam", "selectParam"],
    props,
    slots,
    children: false,
})
