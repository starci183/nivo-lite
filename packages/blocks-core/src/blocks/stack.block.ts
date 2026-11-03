import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { EnumSchema } from "./schema-types"

/** The gap roles a stack may name; the Grammar resolves each to its step. */
export const STACK_GAPS = ["identity", "inline", "row", "section", "region"] as const

const props: z.ZodObject<{ gap: EnumSchema<(typeof STACK_GAPS)[number]> }> = z.object({ gap: z.enum(STACK_GAPS) })
const slots: Record<never, never> = {}

/** Stacks its child blocks with one gap of the Grammar's scale. */
export const stackBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.stack",
    title: { key: "blockStack" },
    props,
    slots,
    children: {},
})
