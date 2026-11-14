import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { RequiredRead, TextSchema } from "../../../../../shared/blocks/schema-types"

const props: z.ZodObject<{ label: TextSchema }> = z.object({ label: specText })

/** The slots of the period figures: the figures of the period. */
type Slots = {
    readonly figures: RequiredRead<"record">
}
const slots: Slots = { figures: { kind: "read", shape: "record", required: true } }

/**
 * The four figures of the period: the income, the receivable, the payments that matched nothing and the open invoices by age, each
 * with the line under it that says what it is made of, in the words of the viewer.
 */
export const accountingPeriodFiguresBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "sales.period-figures",
    title: { key: "blockAccountingPeriodFigures" },
    props,
    slots,
    children: false,
})
