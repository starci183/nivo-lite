import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition, BlockSlots } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"

const props = z.object({ doneLabel: specText, connectionsLabel: specText, knowledgeLabel: specText })
const slots = {
    done: { kind: "read", shape: "record", required: true },
    connections: { kind: "read", shape: "record", required: true },
    knowledge: { kind: "read", shape: "record", required: true },
} as const satisfies BlockSlots

/** What the agent finished, the connections it acts through and what it knows: one card each, each failing on its own. */
export const dashboardCardsBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.dashboard-cards",
    title: { key: "blockDashboardCards" },
    props,
    slots,
    children: false,
})
