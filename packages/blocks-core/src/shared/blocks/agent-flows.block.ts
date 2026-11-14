import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { PATH_MAX } from "./bounds"
import type { RequiredRead, TextSchema } from "./schema-types"

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    fact: z.ZodOptional<TextSchema>
    flowPath: z.ZodOptional<z.ZodString>
}> = z.object({
    label: specText,
    empty: specText,
    fact: specText.optional(),
    flowPath: z.string().min(1).max(PATH_MAX).optional(),
})

/** The slots of the agent flows block: the agent's active workflows, each with the card view of its running graph. */
type Slots = {
    readonly flows: RequiredRead<"record">
}
const slots: Slots = { flows: { kind: "read", shape: "record", required: true } }

/**
 * How an agent works, read-only: every active workflow of the agent (`platform.agent-flows`), each drawn as the step cards of the
 * workflow canvas (the Grammar's card map of the INSTALLED graph, never written by hand), static and at the small canvas height, ONE
 * graph per card (a card holds one content), the primary first. The first card is headed by `label` and `fact` (its `{workflows}` and
 * `{steps}` filled from the read) with, when `flowPath` is given (a path beside the page, `{key}` filled with the workflow key), the
 * workflow's name as the head link to its page; each further workflow is its own card named by it. With no active workflow the card
 * says `empty` inside.
 */
export const agentFlowsBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.agent-flows",
    title: { key: "blockAgentFlows" },
    props,
    slots,
    children: false,
})
