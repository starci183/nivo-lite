import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeLocale, NodeSchema } from "../../../shared/nodes/node-schema.types"
import { nodeGoalOf } from "../../../shared/nodes/node-ui"
import { occasionDueSchema, type OccasionDue } from "./care-occasion-wait.node"
import { PROFILE_AN, SENT_VIA_ZALO } from "./care.examples"
import { vietnamDayOf } from "./care.policy"
import { customerNameOf, leadContactOf } from "./care.reads"
import { CARE_VOICE, careMessageSchema, refusalSchema, sendToContact } from "./care.steps"
import { answered, refused } from "../../../shared/nodes/tool-answers"
import { SALES_LEAD_ENTITY } from "../../../shared/entities/sales-entity-names"

const ID = "sales.care-occasion"

/** What the suggestion is given: the customer, the occasion the wait found due, and the language. */
export interface CareOccasionInput {
    /** The customer (`= steps.wait.output.leadId`). */
    readonly leadId: string
    /** The occasion (`= steps.wait.output.due`); null only when wired wrongly. */
    readonly due: OccasionDue | null
    /** The language of the message. */
    readonly locale: NodeLocale
}

/** What the suggestion did. */
export interface CareOccasionOutput {
    /** The customer, echoed. */
    readonly leadId: string
    /** True when the suggestion reached the customer. */
    readonly sent: boolean
    /** The send tool's refusal when it did not, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<CareOccasionInput> = z.object({
    leadId: z.string().max(MAX_ID).min(1),
    due: occasionDueSchema.nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<CareOccasionOutput> = z.object({
    leadId: z.string().max(MAX_ID).describe("The id of the customer, as given."),
    sent: z.boolean().describe("True when the suggestion reached the customer."),
    refusal: refusalSchema,
})

const GUIDANCE =
    "The customer's date (the occasion) is coming up. Write ONE gentle message: mention the occasion and suggest ordering something like " +
    "their last order for it. No pressure, no discount, no price."

const SUGGESTION = "Her birthday is coming up. Would you like to see ideas like the roses you sent last time?"

/** The birthday the wait found due, in the examples. */
const DUE: OccasionDue = {
    occasionId: "occ-1",
    label: "birthday",
    month: 1,
    day: 5,
    year: null,
    on: "1970-01-04T17:00:00.000Z",
    recipient: "her",
    lastOrder: { orderNo: "DH-1", items: "1 x roses" },
}

/** The read of the person the customer record `l1` names (`c1`). */
const LEAD_CONTACT = {
    id: TOOL.recordGet,
    args: { type: SALES_LEAD_ENTITY, id: "l1" },
    answer: answered({ record: { id: "l1", values: { contactId: "c1" } } }),
}

/**
 * `sales.care-occasion` (Goi y dat lai cho dip): `occasionLeadDays` before a date the customer mentioned, the agent writes ONE gentle
 * suggestion to order again from the occasion and the last paid order, and the node sends it (`nivo.tool.customer.message.send`). The timing
 * and the guards are `sales.care-occasion-wait`'s; next year's timer is `sales.care-occasion-rearm`'s.
 */
export const salesCareOccasionNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeSalesCareOccasionTitle"),
    description: { vi: "Tr\u01b0\u1edbc ng\u00e0y \u0111\u1eb7c bi\u1ec7t c\u1ee7a kh\u00e1ch, g\u1eedi m\u1ed9t l\u1eddi g\u1ee3i \u00fd nh\u1eb9 nh\u00e0ng \u0111\u1eb7t l\u1ea1i theo d\u1ecbp v\u00e0 \u0111\u01a1n \u0111\u00e3 mua g\u1ea7n nh\u1ea5t.", en: "Before a customer's special date, sends one gentle suggestion to order again, based on the occasion and the last paid order." },
    tools: [TOOL.contactGet, TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const due = given.due
        if (due === null)
            return context.fail({ kind: "cannot", why: "the suggestion was reached with no occasion due" })
        // The person to write to is the contact the sale's record of the customer names; a record that names none has nobody to write to.
        const contactId = await leadContactOf(context, given.leadId)
        if (contactId === null) return { leadId: given.leadId, sent: false, refusal: null }
        const name = await customerNameOf(context)
        const message = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE} ${CARE_VOICE}`,
            input: {
                locale: given.locale,
                occasion: { label: due.label, on: vietnamDayOf(due.on) },
                lastOrder: due.lastOrder,
                customer: { name, recipient: due.recipient },
            },
            output: careMessageSchema,
            tools: [],
            maxTurns: 1,
        })
        return { leadId: given.leadId, ...(await sendToContact(context, contactId, message.text)) }
    },
    examples: [
        {
            name: "a customer record that names no person has nobody to write to: nothing is sent",
            params: {},
            input: { leadId: "l1", due: DUE, locale: "en" },
            tools: [{ ...LEAD_CONTACT, answer: answered({ record: { id: "l1", values: { contactId: null } } }) }],
            output: { leadId: "l1", sent: false, refusal: null },
        },
        {
            name: "inside the lead time of a birthday the agent suggests ordering again",
            params: {},
            input: { leadId: "l1", due: DUE, locale: "en" },
            tools: [
                LEAD_CONTACT,
                { id: TOOL.contactGet, args: {}, answer: PROFILE_AN },
                { id: TOOL.customerMessageSend, args: { contactId: "c1", text: SUGGESTION }, answer: SENT_VIA_ZALO },
            ],
            agent: [{ answer: { text: SUGGESTION } }],
            output: { leadId: "l1", sent: true, refusal: null },
        },
        {
            name: "a send the tool refuses is reported in the output",
            params: {},
            input: { leadId: "l1", due: DUE, locale: "en" },
            tools: [
                LEAD_CONTACT,
                { id: TOOL.contactGet, args: {}, answer: PROFILE_AN },
                {
                    id: TOOL.customerMessageSend,
                    args: { contactId: "c1", text: SUGGESTION },
                    answer: refused("customer_opted_out"),
                },
            ],
            agent: [{ answer: { text: SUGGESTION } }],
            output: { leadId: "l1", sent: false, refusal: "customer_opted_out" },
        },
    ],
})
