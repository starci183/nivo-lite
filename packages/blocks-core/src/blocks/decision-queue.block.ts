import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition, BlockSlots } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"

/** Where a queue stands: a card on a card page, or a section in a pane. */
export const QUEUE_SURFACES = ["card", "section"] as const

const props = z.object({
    surface: z.enum(QUEUE_SURFACES),
    label: specText,
    emptyTitle: specText,
    emptyBody: specText,
    seeWhy: specText,
    moreMenu: specText,
})
const slots = {
    queue: { kind: "read", shape: "record", required: true },
    command: { kind: "action", required: false },
} as const satisfies BlockSlots

/** The decisions waiting for a person, each decided in place through a command on its row. */
export const decisionQueueBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.decision-queue",
    title: { key: "blockDecisionQueue" },
    props,
    slots,
    children: false,
})
