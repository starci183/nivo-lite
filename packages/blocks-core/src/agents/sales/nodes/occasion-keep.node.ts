import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { OCCASIONS_MAX, saidOccasionSchema, type SaidOccasion } from "./consult.occasion"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"

/** The customer, and the dates the consult heard them mention (each null when the turn had none: then nothing is kept). */
export interface OccasionKeepInput {
    /** The customer whose memory keeps the dates, or null while the conversation has none. */
    readonly contactId: string | null
    /** The dates, as the consult handed them on, or null when the customer mentioned none. */
    readonly occasions: ReadonlyArray<SaidOccasion> | null
}

/** What was kept. */
export interface OccasionKeepOutput {
    /** How many dates went into the customer's memory. */
    readonly kept: number
    /** True when a person declined keeping the dates on its card: nothing was kept; the graph routes on it. */
    readonly declined: boolean
}

const input: NodeSchema<OccasionKeepInput> = z.object({
    contactId: z.string().min(1).max(MAX_ID).nullable(),
    occasions: z.array(saidOccasionSchema).min(1).max(OCCASIONS_MAX).nullable(),
})

const output: NodeSchema<OccasionKeepOutput> = z.object({
    kept: z.number().int().min(0).max(OCCASIONS_MAX),
    declined: z.boolean().describe("True when a person declined keeping the dates on its card: nothing was kept."),
})

/** The two dates of the example. */
const OCCASIONS = [
    { label: "Lan's birthday", date: "11-21" },
    { label: "the wedding anniversary", date: "2027-03-08" },
]

/**
 * `sales.occasion-keep` (Ghi nho ngay cua khach): keeps the dates a customer mentioned during the consult (a birthday, an anniversary) in
 * the customer's memory for later care (D-MX-6), through `nivo.tool.contact.memory.remember` (the contact the run serves). A plain tool
 * call: the consult already read the words; here nothing is decided. With no dates, or no customer yet, there is nothing to keep and no tool is
 * called (the sale runs this step after every talk; the check is exact). A side step (`blocking: false`): a failed keep is reported and the customer's path goes on.
 */
export const salesOccasionKeepNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.occasion-keep",
    title: bilingualOf("nodeSalesOccasionKeepTitle"),
    description: { vi: "Ghi nh\u1edb nh\u1eefng ng\u00e0y \u0111\u1eb7c bi\u1ec7t kh\u00e1ch k\u1ec3 trong l\u00fac t\u01b0 v\u1ea5n (sinh nh\u1eadt, k\u1ef7 ni\u1ec7m) \u0111\u1ec3 ch\u0103m s\u00f3c v\u1ec1 sau.", en: "Remembers the special dates the customer mentioned during the consult (birthday, anniversary) for later care." },
    tools: [TOOL.contactMemoryRemember],
    mode: "auto",
    accounts: [],
    input,
    output,
    blocking: false,
    run: async (given, context) => {
        const { contactId, occasions } = given
        if (contactId === null || occasions === null) return { kept: 0, declined: false }
        const remembered = await context.tools.call(TOOL.contactMemoryRemember, {
            facts: { occasions: occasions.map(({ label, date }) => ({ label, date })) },
        })
        if (!remembered.ok && remembered.declined === true)
            return { kept: 0, declined: true }
        valueOrCannot(context, TOOL.contactMemoryRemember, remembered)
        return { kept: occasions.length, declined: false }
    },
    examples: [
        {
            name: "a birthday and a one-off anniversary the customer mentioned go into the customer's memory as occasions",
            params: {},
            input: { contactId: "contact-1", occasions: OCCASIONS },
            tools: [
                {
                    id: TOOL.contactMemoryRemember,
                    args: { facts: { occasions: OCCASIONS } },
                    answer: answered({ remembered: ["occasions"], contactId: "contact-1" }),
                },
            ],
            output: { kept: 2, declined: false },
        },
        {
            name: "a person declines keeping the dates: nothing is kept and the node says declined",
            params: {},
            input: { contactId: "contact-1", occasions: OCCASIONS },
            tools: [
                {
                    id: TOOL.contactMemoryRemember,
                    args: { facts: { occasions: OCCASIONS } },
                    answer: refused("declined"),
                },
            ],
            output: { kept: 0, declined: true },
        },
        {
            name: "a turn with no dates mentioned keeps nothing and calls no tool",
            params: {},
            input: { contactId: "contact-1", occasions: null },
            tools: [],
            output: { kept: 0, declined: false },
        },
    ],
})
