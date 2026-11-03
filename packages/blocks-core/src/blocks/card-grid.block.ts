import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition, BlockSlots } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"

const props = z.object({})
const slots = {} as const satisfies BlockSlots

/** Lays its child blocks out as a grid of cards. */
export const cardGridBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.card-grid",
    title: { key: "blockCardGrid" },
    props,
    slots,
    children: {},
})
