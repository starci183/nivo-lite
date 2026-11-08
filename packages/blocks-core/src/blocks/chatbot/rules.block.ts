import { defineBlock, type BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { RequiredAction, RequiredRead } from "../schema-types"

/** The rules form takes no props: its two settings, their bounds and their words are the Chatbot's own. */
const props: z.ZodObject<Record<string, never>> = z.object({})

/** The slots of the rules form: the settings the workspace saved, and the action that saves them. */
type Slots = {
    readonly settings: RequiredRead<"record">
    readonly save: RequiredAction
}
const slots: Slots = {
    settings: { kind: "read", shape: "record", required: true },
    save: { kind: "action", required: true },
}

/**
 * The the rules view of the Chatbot: how long it waits for the AI's reply before it sends a holding message (5 to 120 seconds) and
 * what that holding message says (up to 400 characters). Owners and managers edit; anyone else reads. The bounds are the rules
 * of the module, so the block validates before it saves and shows the action's refusals on the field they belong to.
 */
export const rulesBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "chatbot.rules",
    title: { key: "block_rules" },
    props,
    slots,
    children: false,
})
