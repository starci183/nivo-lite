import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { OptionalAction, RequiredRead, TextSchema } from "./schema-types"

const props: z.ZodObject<{ label: TextSchema; idle: z.ZodOptional<TextSchema> }> = z.object({
    label: specText,
    idle: specText.optional(),
})

/** The slots of the run timeline block: the run it shows, and the action that runs a parked run again. */
type Slots = {
    readonly run: RequiredRead<"record">
    readonly resume: OptionalAction
}
const slots: Slots = {
    run: { kind: "read", shape: "record", required: true },
    resume: { kind: "action", required: false },
}

/**
 * The ordered steps of one run: the node, what it was given and produced, how long it took, the door calls with their results, the
 * effect key, and for a parked step its reason with the one command that runs it again; a waiting step links to its approval.
 * With no run chosen it says so instead of failing.
 */
export const runTimelineBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.run-timeline",
    title: { key: "blockRunTimeline" },
    props,
    slots,
    children: false,
})
