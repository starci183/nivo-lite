import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { paramName, type ParamNameSchema } from "../param-name"
import type { RequiredRead, TextSchema } from "../schema-types"

const props: z.ZodObject<{ title: TextSchema; empty: TextSchema; periodParam: ParamNameSchema }> = z.object({
    title: specText,
    empty: specText,
    periodParam: paramName,
})

/** The slots of the ledger: the cash book of the period. */
type Slots = {
    readonly ledger: RequiredRead<"record">
}
const slots: Slots = { ledger: { kind: "read", shape: "record", required: true } }

/**
 * The cash book (so quy) of a period: a band with the opening balance, the money in, the money out and the closing balance, then each
 * day with its lines as money in, money out and the running balance. The period control writes `periodParam`.
 */
export const accountingLedgerBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "accounting.ledger",
    title: { key: "blockAccountingLedger" },
    props,
    slots,
    children: false,
    params: ["periodParam"],
})
