import { defineNode, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { askTextOf } from "./order.policy"
import { orderGapSchema, type OrderGap } from "./order.schema"
import type { NodeSchema } from "../node-schema.types"
import type { AskLocale } from "./ask-missing.messages"
import { MAX_BODY, MAX_ENTRIES, MAX_ID } from "../../bounds"
import { bilingualOf, messageOf, sampleOf } from "../../messages/catalog"

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
    conversationId: z.string().max(MAX_ID).min(1),
    missing: z.array(orderGapSchema).max(MAX_ENTRIES),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<AskMissingOutput> = z.object({ asked: z.boolean(), text: z.string().max(MAX_BODY).nullable() })

/** `order.ask-missing`: asks the customer for what the order lacks, on the channel of the conversation. It asks and promises nothing. */
export const orderAskMissingNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "order.ask-missing",
    role: "output",
    title: bilingualOf("nodeOrderAskMissingTitle"),
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
                text: `${messageOf("vi", "askIntro")}\n${messageOf("vi", "askNoAddress")}`,
            },
            grant: EXAMPLE_GRANT,
            effects: [
                {
                    kind: "channel.send",
                    payload: {
                        conversationId: "conv-1",
                        text: `${messageOf("vi", "askIntro")}\n${messageOf("vi", "askNoAddress")}`,
                    },
                },
            ],
        },
        {
            name: "asks in English for an item the shop lacks",
            params: {},
            input: {
                conversationId: "conv-1",
                missing: [{ reason: "not_in_catalogue", item: sampleOf("sampleRuou") }],
                locale: "en",
            },
            output: {
                asked: true,
                text: `${messageOf("en", "askIntro")}\n${messageOf("en", "askNotInCatalogue").replace("{{item}}", sampleOf("sampleRuou"))}`,
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
