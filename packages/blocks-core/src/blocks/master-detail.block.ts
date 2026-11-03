import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { TextSchema } from "./schema-types"

const props: z.ZodObject<{ emptyTitle: TextSchema; emptyBody: TextSchema }> = z.object({
    emptyTitle: specText,
    emptyBody: specText,
})
const slots: Record<never, never> = {}

/** A list and the detail of the chosen record: its first child is the list, its second the detail. */
export const masterDetailBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.master-detail",
    title: { key: "blockMasterDetail" },
    props,
    slots,
    children: { max: 2 },
})
