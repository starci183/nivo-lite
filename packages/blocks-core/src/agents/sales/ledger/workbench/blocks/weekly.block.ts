import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName, type ParamNameSchema } from "../../../../../shared/blocks/param-name"
import type { RequiredRead, TextSchema } from "../../../../../shared/blocks/schema-types"

const props: z.ZodObject<{
    title: TextSchema
    caption: TextSchema
    empty: TextSchema
    periodParam: ParamNameSchema
}> = z.object({
    title: specText,
    caption: specText,
    empty: specText,
    periodParam: paramName,
})

/** The slots of the weekly chart: the money received in each week. */
type Slots = {
    readonly weekly: RequiredRead<"record">
}
const slots: Slots = { weekly: { kind: "read", shape: "record", required: true } }

/**
 * The income of a period by week as bars, under a head that names the month and a control that switches between this month and last
 * month by writing `periodParam`.
 */
export const accountingWeeklyBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "sales.weekly",
    title: { key: "blockAccountingWeekly" },
    props,
    slots,
    children: false,
    params: ["periodParam"],
})
