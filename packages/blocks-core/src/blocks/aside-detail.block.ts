import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { EnumSchema } from "./schema-types"

/** How wide the aside stands beside the main content. */
export const ASIDE_WIDTHS = ["compact", "standard", "medium", "wide"] as const

const props: z.ZodObject<{ width: z.ZodOptional<EnumSchema<(typeof ASIDE_WIDTHS)[number]>> }> = z.object({
    width: z.enum(ASIDE_WIDTHS).optional(),
})
const slots: Record<never, never> = {}

/** The main content and an aside beside it; the aside folds under the main content on a phone. The first child is the main, the second the aside. */
export const asideDetailBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.aside-detail",
    title: { key: "blockAsideDetail" },
    props,
    slots,
    children: { max: 2 },
})
