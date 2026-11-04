import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"

const ID_MAX = 100
const NAME_MAX = 200

type NoParams = Record<string, never>

/** The conversation whose customer is wanted, and what the chat knows of them. */
export interface LeadEnsureInput {
    /** The conversation. */
    readonly conversationId: string
    /** The name the customer gave, or null. */
    readonly name: string | null
    /** The phone the customer gave, or null. */
    readonly phone: string | null
    /** The channel the conversation runs on. */
    readonly channel: string
}

/** The customer of the conversation. */
export interface LeadEnsureOutput {
    /** The customer's id. */
    readonly leadId: string
}

const params: NodeSchema<NoParams> = z.strictObject({})

const input: NodeSchema<LeadEnsureInput> = z.object({
    conversationId: z.string().min(1).max(ID_MAX),
    name: z.string().min(1).max(NAME_MAX).nullable(),
    phone: z.string().min(1).max(NAME_MAX).nullable(),
    channel: z.string().min(1).max(ID_MAX),
})

const output: NodeSchema<LeadEnsureOutput> = z.object({ leadId: z.string().min(1) })

/** What the agent must hold for the effect: the host checks it, the node itself reads and writes no data. */
const EFFECT_GRANT = {
    rights: [{ kind: "sales-lead", access: "write", scope: "turn", fields: ["contactName", "phone", "channel"] }],
} as const

/**
 * `lead.ensure`: makes sure the conversation has a customer, the one it already has or a new one made from what the chat knows, and
 * answers its id for the nodes after it. Once per conversation across runs (dedupe key `lead:<conversationId>`). It is a pivot: a customer
 * other records may already point at is not taken back.
 */
export const leadEnsureNode: NodeDefinition<
    NodeSchema<LeadEnsureInput>,
    NodeSchema<LeadEnsureOutput>,
    NodeSchema<NoParams>
> = defineNode({
    id: "lead.ensure",
    role: "output",
    title: { vi: "Xác định khách hàng", en: "Make sure the customer is known" },
    params,
    input,
    output,
    rights: [],
    effects: ["lead.ensure"],
    run: async (given, context) => {
        const lead = await context.effect(
            "lead.ensure",
            {
                conversationId: given.conversationId,
                channel: given.channel,
                ...(given.name === null ? {} : { name: given.name }),
                ...(given.phone === null ? {} : { phone: given.phone }),
            },
            { dedupeKey: `lead:${given.conversationId}` },
        )
        return { leadId: lead.id }
    },
    examples: [
        {
            name: "makes sure a customer who gave a name and a phone has a lead",
            grant: EFFECT_GRANT,
            params: {},
            input: { conversationId: "c1", name: "Lan", phone: "0901234567", channel: "zalo" },
            output: { leadId: "lead.ensure-1" },
            effects: [
                {
                    kind: "lead.ensure",
                    payload: { conversationId: "c1", channel: "zalo", name: "Lan", phone: "0901234567" },
                },
            ],
        },
        {
            name: "asks with the channel alone when the chat knows nothing else of the customer",
            grant: EFFECT_GRANT,
            params: {},
            input: { conversationId: "c2", name: null, phone: null, channel: "telegram" },
            output: { leadId: "lead.ensure-1" },
            effects: [{ kind: "lead.ensure", payload: { conversationId: "c2", channel: "telegram" } }],
        },
    ],
})
