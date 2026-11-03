import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { TextSchema } from "./schema-types"

const props: z.ZodObject<{ title: TextSchema; hint: z.ZodOptional<TextSchema> }> = z.object({
    title: specText,
    hint: specText.optional(),
})
const slots: Record<never, never> = {}

/** A titled card holding child blocks, with an optional hint over them. */
export const sectionBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.section",
    title: { key: "blockSection" },
    props,
    slots,
    children: {},
})
