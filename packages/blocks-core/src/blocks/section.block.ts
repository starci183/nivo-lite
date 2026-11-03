import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition, BlockSlots } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"

const props = z.object({ title: specText, hint: specText.optional() })
const slots = {} as const satisfies BlockSlots

/** A titled card holding child blocks, with an optional hint over them. */
export const sectionBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.section",
    title: { key: "blockSection" },
    props,
    slots,
    children: {},
})
