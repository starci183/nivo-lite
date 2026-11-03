import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { TextSchema, RequiredRead } from "./schema-types"

const props: z.ZodObject<{ doneLabel: TextSchema; connectionsLabel: TextSchema; knowledgeLabel: TextSchema }> =
    z.object({ doneLabel: specText, connectionsLabel: specText, knowledgeLabel: specText })
/** The slots of the dashboard cards block: one record per card. */
type Slots = {
    readonly done: RequiredRead<"record">
    readonly connections: RequiredRead<"record">
    readonly knowledge: RequiredRead<"record">
}
const slots: Slots = {
    done: { kind: "read", shape: "record", required: true },
    connections: { kind: "read", shape: "record", required: true },
    knowledge: { kind: "read", shape: "record", required: true },
}

/** What the agent finished, the connections it acts through and what it knows: one card each, each failing on its own. */
export const dashboardCardsBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.dashboard-cards",
    title: { key: "blockDashboardCards" },
    props,
    slots,
    children: false,
})
