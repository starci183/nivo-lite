import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { LEAD_STAGES } from "../../rules/sales/stage"
import { paramName, type ParamNameSchema } from "../param-name"
import type { EnumSchema, OptionalAction, OptionalRead, RequiredRead, TextSchema } from "../schema-types"

const props: z.ZodObject<{
    label: TextSchema
    searchLabel: TextSchema
    countLabel: TextSchema
    emptyColumn: TextSchema
    emptySearch: z.ZodOptional<TextSchema>
    stages: z.ZodOptional<z.ZodArray<EnumSchema<(typeof LEAD_STAGES)[number]>>>
    selectParam: ParamNameSchema
    searchParam: ParamNameSchema
}> = z.object({
    label: specText,
    searchLabel: specText,
    countLabel: specText,
    emptyColumn: specText,
    emptySearch: specText.optional(),
    stages: z.array(z.enum(LEAD_STAGES)).min(1).max(LEAD_STAGES.length).optional(),
    selectParam: paramName,
    searchParam: paramName,
})

/** The slots of the pipeline: the leads, how many each stage holds, and the move of a lead to another stage. */
type Slots = {
    readonly rows: RequiredRead<"list">
    readonly counts: OptionalRead<"record">
    readonly move: OptionalAction
}

const slots: Slots = {
    rows: { kind: "read", shape: "list", required: true },
    counts: { kind: "read", shape: "record", required: false },
    move: { kind: "action", required: false },
}

/**
 * The Sales pipeline: the leads in a column for each stage, under a head that counts them and a search. A card is the customer and
 * the company, what the deal is (an order or quote amount, else the need) and a line for its stage (where it came from, the next step
 * and when it is due, why it was lost). A card moves between stages by drag or by keyboard through the `move` action, and pressing a
 * card writes the lead to `selectParam`. `stages` narrows which columns show.
 */
export const salesPipelineBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "sales.pipeline",
    title: { key: "block_pipeline" },
    params: ["selectParam", "searchParam"],
    props,
    slots,
    children: false,
})
