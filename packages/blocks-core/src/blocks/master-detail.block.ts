import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition, BlockSlots } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"

const props = z.object({ emptyTitle: specText, emptyBody: specText })
const slots = {} as const satisfies BlockSlots

/** A list and the detail of the chosen record: its first child is the list, its second the detail. */
export const masterDetailBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.master-detail",
    title: { key: "blockMasterDetail" },
    props,
    slots,
    children: { max: 2 },
})
