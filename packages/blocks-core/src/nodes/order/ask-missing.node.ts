import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { askTextOf } from "./order.policy"
import { orderGapSchema } from "./order.schema"
import type { NodeSchema } from "../node-schema.types"
import type { OrderGap } from "./order.schema"
import type { AskLocale } from "./ask-missing.messages"

/** What to ask, and where. */
export interface AskMissingInput {
    /** The conversation the customer is in. */
    readonly conversationId: string
    /** What the order lacks. */
    readonly missing: ReadonlyArray<OrderGap>
    /** The language to ask in. */
    readonly locale: AskLocale
}

/** What was asked. */
export interface AskMissingOutput {
    /** True when a question went out. */
    readonly asked: boolean
    /** The text sent, or null when nothing was missing. */
    readonly text: string | null
}

/** The agent grant the examples run under: the rights of the effect the node runs. */
const EXAMPLE_GRANT: RightsGrant = { rights: [{ kind: "message", access: "write", scope: "turn", fields: ["body"] }] }

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<AskMissingInput> = z.object({
    conversationId: z.string().min(1),
    missing: z.array(orderGapSchema),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<AskMissingOutput> = z.object({ asked: z.boolean(), text: z.string().nullable() })

/** `order.ask-missing`: asks the customer for what the order lacks, on the channel of the conversation. It asks and promises nothing. */
export const orderAskMissingNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "order.ask-missing",
    role: "output",
    title: { vi: "Hỏi thông tin còn thiếu", en: "Ask for what is missing" },
    params,
    input,
    output,
    rights: [],
    effects: ["channel.send"],
    run: async (given, context) => {
        if (given.missing.length === 0) return { asked: false, text: null }
        const text = askTextOf(given.missing, given.locale)
        await context.effect("channel.send", { conversationId: given.conversationId, text })
        return { asked: true, text }
    },
    examples: [
        {
            name: "asks in Vietnamese for the address",
            params: {},
            input: { conversationId: "conv-1", missing: [{ reason: "no_address", item: null }], locale: "vi" },
            output: {
                asked: true,
                text: "Để ghi nhận đơn, shop cần thêm thông tin:\nBạn cho shop xin địa chỉ nhận hàng nhé?",
            },
            grant: EXAMPLE_GRANT,
            effects: [
                {
                    kind: "channel.send",
                    payload: {
                        conversationId: "conv-1",
                        text: "Để ghi nhận đơn, shop cần thêm thông tin:\nBạn cho shop xin địa chỉ nhận hàng nhé?",
                    },
                },
            ],
        },
        {
            name: "asks in English for an item the shop lacks",
            params: {},
            input: {
                conversationId: "conv-1",
                missing: [{ reason: "not_in_catalogue", item: "Rượu" }],
                locale: "en",
            },
            output: {
                asked: true,
                text: "To note down the order, we need a little more:\nWe do not have “Rượu”; could you pick another item?",
            },
            grant: EXAMPLE_GRANT,
            effects: ["channel.send"],
        },
        {
            name: "sends nothing when nothing is missing",
            params: {},
            input: { conversationId: "conv-1", missing: [], locale: "en" },
            output: { asked: false, text: null },
            grant: EXAMPLE_GRANT,
            effects: [],
        },
    ],
})
