import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition, BlockSlots } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"

/** The gap roles a stack may name; the Grammar resolves each to its step. */
export const STACK_GAPS = ["identity", "inline", "row", "section", "region"] as const

const props = z.object({ gap: z.enum(STACK_GAPS) })
const slots = {} as const satisfies BlockSlots

/** Stacks its child blocks with one gap of the Grammar's scale. */
export const stackBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.stack",
    title: { key: "blockStack" },
    props,
    slots,
    children: {},
})
