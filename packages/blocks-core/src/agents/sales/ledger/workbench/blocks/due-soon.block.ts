import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { RequiredRead, TextSchema } from "../../../../../shared/blocks/schema-types"

const props: z.ZodObject<{
    title: TextSchema
    horizon: TextSchema
    empty: TextSchema
    notice: TextSchema
    linkLabel: TextSchema
    linkPath: z.ZodString
}> = z.object({
    title: specText,
    horizon: specText,
    empty: specText,
    notice: specText,
    linkLabel: specText,
    linkPath: z.string().max(200),
})

/** The slots of the due-soon list: the declarations that fall due. */
type Slots = {
    readonly due: RequiredRead<"record">
}
const slots: Slots = { due: { kind: "read", shape: "record", required: true } }

/**
 * The tax declarations that fall due soon, each with the date and the days left, and a notice under them that only the tax deadlines
 * are listed until an invoice tool is connected, with the link to connect one at `linkPath`.
 */
export const accountingDueSoonBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "sales.due-soon",
    title: { key: "blockAccountingDueSoon" },
    props,
    slots,
    children: false,
})
