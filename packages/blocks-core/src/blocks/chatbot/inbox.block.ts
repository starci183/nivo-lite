import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { paramName } from "../param-name"
import type { OptionalAction, RequiredRead } from "../schema-types"

/** The params the inbox writes: the search text, the tab, and the conversation that is open. */
const props: z.ZodObject<{
    searchParam: z.ZodString
    statusParam: z.ZodString
    selectParam: z.ZodString
}> = z.object({ searchParam: paramName, statusParam: paramName, selectParam: paramName })

/**
 * The slots of the inbox: the conversations with their counts per tab, the open conversation with its lines, and what a person may
 * do with it. The reply the AI proposed is not a slot of this block: it is the `chatbot.approval-card` the spec places in it.
 */
type Slots = {
    readonly threads: RequiredRead<"list">
    readonly counts: RequiredRead<"record">
    readonly messages: RequiredRead<"list">
    readonly thread: RequiredRead<"record">
    readonly send: OptionalAction
    readonly handoff: OptionalAction
    readonly release: OptionalAction
}
const slots: Slots = {
    threads: { kind: "read", shape: "list", required: true },
    counts: { kind: "read", shape: "record", required: true },
    messages: { kind: "read", shape: "list", required: true },
    thread: { kind: "read", shape: "record", required: true },
    send: { kind: "action", required: false },
    handoff: { kind: "action", required: false },
    release: { kind: "action", required: false },
}

/**
 * The Chatbot inbox in three panes. The list of conversations (search, the tabs all, needs a person and today with their
 * counts, and a row per conversation with its avatar, name, last words, time, status and channel), the open conversation (its head
 * with the take-over control, the lines under day dividers, the approval card of the reply the AI drafted, and the composer), and the
 * contact of the customer. The one child it takes is the approval card, which stands under the lines of the open conversation. The
 * words and the order of every pane are the module's own; the spec places the block and names its params.
 */
export const inboxBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "chatbot.inbox",
    title: { key: "block_inbox" },
    props,
    slots,
    params: ["searchParam", "statusParam", "selectParam"],
    children: { max: 1, accepts: ["chatbot.approval-card"] },
})
