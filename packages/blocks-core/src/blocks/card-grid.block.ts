import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"

const props: z.ZodObject<{}> = z.object({})
const slots: Record<never, never> = {}

/** Lays its child blocks out as a grid of cards. */
export const cardGridBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.card-grid",
    title: { key: "blockCardGrid" },
    props,
    slots,
    children: {},
})
