import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { REPLY_MAX } from "../../rules/chatbot/reply"
import type { OptionalAction, RequiredAction, RequiredRead } from "../schema-types"
import { z } from "zod"

/** The one thing the spec may set on the card: how long the changed reply may be. */
const props: z.ZodObject<{ maxLength: z.ZodDefault<z.ZodNumber> }> = z.object({
    maxLength: z.number().int().min(1).max(REPLY_MAX).default(REPLY_MAX),
})

/**
 * The slots of the approval card: the reply the AI proposed for the open conversation, and what a person does with it. Approving
 * is the action `chatbot.approve-and-send` (also with changed words); dismissing is its own action. The card runs no logic of its
 * own: the status of the line, the delivery and the refusals are the actions'.
 */
type Slots = {
    readonly proposal: RequiredRead<"record">
    readonly approve: RequiredAction
    readonly dismiss: OptionalAction
}
const slots: Slots = {
    proposal: { kind: "read", shape: "record", required: true },
    approve: { kind: "action", required: true },
    dismiss: { kind: "action", required: false },
}

/**
 * The card inside the thread of the Chatbot inbox that holds the reply the AI drafted: the waiting-for-a-person title, what the customer
 * asked, the draft in a quote, a line of guidance, then the approve-and-send button, an edit button (the draft in a field, sent as changed) and a menu
 * that dismisses it. It draws nothing while no draft waits.
 */
export const approvalCardBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "chatbot.approval-card",
    title: { key: "block_approval_card" },
    props,
    slots,
    children: false,
})
