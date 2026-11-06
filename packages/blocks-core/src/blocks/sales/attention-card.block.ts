import { defineBlock } from "@nivo-lite/agent-sdk/block"
import type { BlockDefinition } from "@nivo-lite/agent-sdk/block"
import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { ATTENTION_KINDS } from "../../rules/sales/attention-list"
import { paramName } from "../param-name"
import type { ParamNameSchema } from "../param-name"
import type { EnumSchema, OptionalAction, OptionalRead, RequiredRead, TextSchema } from "../schema-types"

const props: z.ZodObject<{
    label: TextSchema
    empty: TextSchema
    selectParam: z.ZodOptional<ParamNameSchema>
    kinds: z.ZodOptional<z.ZodArray<EnumSchema<(typeof ATTENTION_KINDS)[number]>>>
}> = z.object({
    label: specText,
    empty: specText,
    selectParam: paramName.optional(),
    kinds: z.array(z.enum(ATTENTION_KINDS)).min(1).max(ATTENTION_KINDS.length).optional(),
})

/** The slots of the card: the three reads that fill the list and one command per kind of row. */
type Slots = {
    readonly attention: RequiredRead<"list">
    readonly awaitingReply: OptionalRead<"list">
    readonly failedSteps: OptionalRead<"list">
    readonly respond: OptionalAction
    readonly follow: OptionalAction
    readonly reply: OptionalAction
    readonly review: OptionalAction
    readonly retry: OptionalAction
}

const slots: Slots = {
    attention: { kind: "read", shape: "list", required: true },
    awaitingReply: { kind: "read", shape: "list", required: false },
    failedSteps: { kind: "read", shape: "list", required: false },
    respond: { kind: "action", required: false },
    follow: { kind: "action", required: false },
    reply: { kind: "action", required: false },
    review: { kind: "action", required: false },
    retry: { kind: "action", required: false },
}

/**
 * The "needs attention" list of Sales: what waits for the owner, from the attention read, the customers waiting for a reply and the steps
 * that failed. Each row is a customer, an order or a step, with a chip that says why it waits and one command under the text (respond,
 * follow up, reply, review, retry). The kinds are listed in a fixed order; `kinds` narrows which of them show. With a `selectParam`
 * pressing a customer's row writes the customer to the param.
 */
export const salesAttentionCardBlock: BlockDefinition<typeof props, typeof slots> = defineBlock({
    id: "sales.attention-card",
    title: { key: "block_attention_card" },
    params: ["selectParam"],
    props,
    slots,
    children: false,
})
