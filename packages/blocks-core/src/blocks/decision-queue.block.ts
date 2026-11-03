import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { TextSchema, EnumSchema, RequiredRead, OptionalAction } from "./schema-types"

/** Where a queue stands: a card on a card page, or a section in a pane. */
export const QUEUE_SURFACES = ["card", "section"] as const

const props: z.ZodObject<{
    surface: EnumSchema<(typeof QUEUE_SURFACES)[number]>
    label: TextSchema
    emptyTitle: TextSchema
    emptyBody: TextSchema
    seeWhy: TextSchema
    moreMenu: TextSchema
}> = z.object({
    surface: z.enum(QUEUE_SURFACES),
    label: specText,
    emptyTitle: specText,
    emptyBody: specText,
    seeWhy: specText,
    moreMenu: specText,
})
/** The slots of the decision queue block: the queue read and the command a row may run. */
type Slots = {
    readonly queue: RequiredRead<"record">
    readonly command: OptionalAction
}
const slots: Slots = {
    queue: { kind: "read", shape: "record", required: true },
    command: { kind: "action", required: false },
}

/** The decisions waiting for a person, each decided in place through a command on its row. */
export const decisionQueueBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.decision-queue",
    title: { key: "blockDecisionQueue" },
    props,
    slots,
    children: false,
})
