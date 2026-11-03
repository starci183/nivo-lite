import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition, BlockSlots } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"

const props = z.object({
    label: specText,
    empty: specText,
    idPath: z.string(),
    titlePath: z.string(),
    descriptionPath: z.string().optional(),
    badgePath: z.string().optional(),
})
const slots = {
    rows: { kind: "read", shape: "list", required: true },
    open: { kind: "action", required: false },
} as const satisfies BlockSlots

/** A card listing bound records, with an optional action on each row. */
export const recordListBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.record-list",
    title: { key: "blockRecordList" },
    props,
    slots,
    children: false,
})
