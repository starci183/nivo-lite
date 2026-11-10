import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { OptionalAction, RequiredRead } from "./schema-types"

/** The one thing the spec may set on the shell: how long an edited text may be. */
const props: z.ZodObject<{ maxLength: z.ZodDefault<z.ZodNumber> }> = z.object({
    maxLength: z.number().int().min(1).max(4000).default(2000),
})

/**
 * The slots of the agent message block: the message (one record: the envelope, a kind and its payload, and for an ask its options) and
 * the three things a person may do with it. `approve` runs with `{ id }`, or `{ id, values }` when the payload was edited in place;
 * `reject` runs with `{ id }`; `reply` runs with `{ id, option }` for an ask. A slot a spec leaves unbound draws no control. The block
 * runs no logic of its own.
 */
type Slots = {
    readonly message: RequiredRead<"record">
    readonly approve: OptionalAction
    readonly reject: OptionalAction
    readonly reply: OptionalAction
}
const slots: Slots = {
    message: { kind: "read", shape: "record", required: true },
    approve: { kind: "action", required: false },
    reject: { kind: "action", required: false },
    reply: { kind: "action", required: false },
}

/**
 * One message from an agent, drawn the same wherever it appears (the conversation, the desk, the inbox, the work log). The envelope says
 * which agent, to whom, when, about which work and in which state. The content is a registered kind (text, media, an invoice, rows, a
 * payment request, a report); the block never switches on a kind, and an unknown kind falls back to a summary and the way to open it.
 * The intent is a separate axis: `notify` (nothing to do), `ask` (a question with reply options), `approve` (Approve / Edit / Reject on
 * what the agent wants to do, with the outbound channel and recipient when it is for a customer) or `report`.
 */
export const agentMessageBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "core.agent-message",
    title: { key: "blockAgentMessage" },
    props,
    slots,
    children: false,
})
