import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { RequiredRead, TextSchema } from "../../schema-types"

const props: z.ZodObject<{ title: TextSchema; empty: TextSchema }> = z.object({
    title: specText,
    empty: specText,
})

/** The slots of the ageing: the figures of the period. */
type Slots = {
    readonly figures: RequiredRead<"record">
}
const slots: Slots = { figures: { kind: "read", shape: "record", required: true } }

/** The open invoices by age: a head with how many invoices are open and one gauge per age bucket, each with its count. */
export const accountingAgeingBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "sales.ageing",
    title: { key: "blockAccountingAgeing" },
    props,
    slots,
    children: false,
})
