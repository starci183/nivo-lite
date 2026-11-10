import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { EnumSchema, OptionalRead, RequiredRead, TextSchema } from "./schema-types"

/** What the cards are drawn as: cards on a page, or sections inside a surface that already holds them (a side pane). */
export const CARDS_SURFACES = ["card", "section"] as const

/** How the cards stand: side by side in a grid of three, or one under another (a narrow side pane). */
export const CARDS_LAYOUTS = ["grid", "stack"] as const

const props: z.ZodObject<{
    doneLabel: z.ZodOptional<TextSchema>
    connectionsLabel: TextSchema
    knowledgeLabel: TextSchema
    layout: z.ZodOptional<EnumSchema<(typeof CARDS_LAYOUTS)[number]>>
    surface: z.ZodOptional<EnumSchema<(typeof CARDS_SURFACES)[number]>>
}> = z.object({
    doneLabel: specText.optional(),
    connectionsLabel: specText,
    knowledgeLabel: specText,
    layout: z.enum(CARDS_LAYOUTS).optional(),
    surface: z.enum(CARDS_SURFACES).optional(),
})
/** The slots of the dashboard cards block: one record per card. */
type Slots = {
    readonly done: OptionalRead<"record">
    readonly connections: RequiredRead<"record">
    readonly knowledge: RequiredRead<"record">
}
const slots: Slots = {
    done: { kind: "read", shape: "record", required: false },
    connections: { kind: "read", shape: "record", required: true },
    knowledge: { kind: "read", shape: "record", required: true },
}

/** What the agent finished (when bound), the connections it acts through and what it knows: one card each, each failing on its own; `layout` `stack` puts them one under another. */
export const dashboardCardsBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.dashboard-cards",
    title: { key: "blockDashboardCards" },
    props,
    slots,
    children: false,
})
