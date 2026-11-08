import { defineNode, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { phoneInText } from "../../rules/sales/contact"
import type { NodeSchema } from "../node-schema.types"

const ID_MAX = 100
const NAME_MAX = 200

type NoParams = Record<string, never>

/** The conversation whose customer is wanted, and what the chat knows of them. */
export interface LeadFromMessageInput {
    /** The conversation. */
    readonly conversationId: string
    /** The name the customer gave, or null. */
    readonly name: string | null
    /** The phone the customer gave, or null: when null, a phone written in the message is taken instead. */
    readonly phone: string | null
    /** The channel the conversation runs on. */
    readonly channel: string
    /** What the customer wrote; the graph hands it over when it has it. */
    readonly text?: string | undefined
}

/** The customer of the conversation. */
export interface LeadFromMessageOutput {
    /** The customer's id. */
    readonly leadId: string
}

const params: NodeSchema<NoParams> = z.strictObject({})

const input: NodeSchema<LeadFromMessageInput> = z.object({
    conversationId: z.string().min(1).max(ID_MAX),
    name: z.string().min(1).max(NAME_MAX).nullable(),
    phone: z.string().min(1).max(NAME_MAX).nullable(),
    channel: z.string().min(1).max(ID_MAX),
    text: z.string().max(MAX_BODY).optional(),
})

const output: NodeSchema<LeadFromMessageOutput> = z.object({ leadId: z.string().min(1).max(ID_MAX) })

/** What the agent must hold for the effect: the host checks it, the node itself reads and writes no data. */
const EFFECT_GRANT = {
    rights: [{ kind: "sales-lead", access: "write", scope: "turn", fields: ["contactName", "phone", "channel"] }],
} as const

/**
 * `sales.lead-from-message`: makes sure the conversation has a customer, the one it already has or a new one made from what the chat
 * knows (the name and phone it was given, else a phone number the customer wrote in the message), and answers its id for the nodes
 * after it. Once per conversation across runs (dedupe key `lead:<conversationId>`). It is a pivot: a customer other records may
 * already point at is not taken back.
 */
export const salesLeadFromMessageNode: NodeDefinition<
    NodeSchema<LeadFromMessageInput>,
    NodeSchema<LeadFromMessageOutput>,
    NodeSchema<NoParams>
> = defineNode({
    id: "sales.lead-from-message",
    role: "output",
    title: bilingualOf("nodeSalesLeadFromMessageTitle"),
    params,
    input,
    output,
    rights: [],
    effects: ["lead.ensure"],
    run: async (given, context) => {
        const phone = given.phone ?? phoneInText(given.text ?? "")
        const lead = await context.effect(
            "lead.ensure",
            {
                conversationId: given.conversationId,
                channel: given.channel,
                ...(given.name === null ? {} : { name: given.name }),
                ...(phone === null ? {} : { phone }),
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
        {
            name: "takes the phone the customer wrote in the message when none was given",
            grant: EFFECT_GRANT,
            params: {},
            input: {
                conversationId: "c3",
                name: null,
                phone: null,
                channel: "zalo",
                text: "I would like two sets, call me on 0912 000 701",
            },
            output: { leadId: "lead.ensure-1" },
            effects: [{ kind: "lead.ensure", payload: { conversationId: "c3", channel: "zalo", phone: "0912000701" } }],
        },
    ],
})
