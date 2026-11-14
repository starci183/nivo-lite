import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { CONSULT_STAGES } from "../entities/lead.entity"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { nodeGoalOf } from "../../../shared/nodes/node-ui"
import { refusalSchema } from "./care.steps"
import { answered, refused } from "../../../shared/nodes/tool-answers"
import { SALES_LEAD_ENTITY } from "../../../shared/entities/sales-entity-names"

const ID = "sales.web-order-keep"

/** What the website form gave: the customer and their request in their own words. */
export interface WebOrderKeepInput {
    /** The customer the form made (`= steps.lead.output.leadId`). */
    readonly leadId: string
    /** What the customer asked for, free text (`= trigger.request`). */
    readonly request: string
}

/** What the step kept on the customer. */
export interface WebOrderKeepOutput {
    /** The customer, echoed. */
    readonly leadId: string
    /** True when the stage and facts were written. */
    readonly kept: boolean
    /** The update tool's refusal when they were not, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<WebOrderKeepInput> = z.object({
    leadId: z.string().max(MAX_ID).min(1),
    request: z.string().max(MAX_BODY),
})

const output: NodeSchema<WebOrderKeepOutput> = z.object({
    leadId: z.string().max(MAX_ID).describe("The id of the customer, as given."),
    kept: z.boolean().describe("True when the stage and the facts were written on the customer."),
    refusal: refusalSchema,
})

/** The lead facts the agent names from the request; each is absent when the request does not say it. */
type WebOrderFacts = {
    /** The name of the person who receives the order. */
    readonly recipientName?: string | undefined
    /** The occasion the order is for. */
    readonly occasion?: string | undefined
    /** When the order is to be delivered. */
    readonly deliveryAt?: string | undefined
    /** Where the order is to be delivered. */
    readonly address?: string | undefined
}

/** What the agent reads off the request: the consult stage it puts the customer in, and the lead facts it names. */
interface WebOrderReading {
    readonly consultStage: string
    readonly facts: WebOrderFacts
}

const fact = z.string().min(1).max(MAX_LINE).optional()

const readingSchema: z.ZodType<WebOrderReading> = z.object({
    consultStage: z.enum(CONSULT_STAGES).describe("The consult stage the request puts the customer in."),
    facts: z
        .object({ recipientName: fact, occasion: fact, deliveryAt: fact, address: fact })
        .describe("Only what the request itself says; leave out what it does not name."),
})

const GUIDANCE =
    "The customer wrote through the website form, so nobody can answer them in a chat: the team calls them back. Read what the request " +
    "tells about the customer: the consult stage it puts them in, and the lead facts it names (who the order is for, the occasion, the " +
    "delivery time, the address). The products go to the team in the next step, not here."

const READING = { consultStage: "close", facts: { address: "25 Nguy\u1ec5n Hu\u1ec7" } }

/** The facts the request named, as the update takes them: a member the request did not name is left out, never written empty. */
const namedFactsOf = (facts: WebOrderReading["facts"]): JsonObject =>
    Object.fromEntries(Object.entries(facts).filter((entry): entry is [string, string] => entry[1] !== undefined))

/** The record update that puts one customer in a consult stage. */
const STAGE_OF = (leadId: string, stage: string) => ({ type: SALES_LEAD_ENTITY, id: leadId, patch: { consultStage: stage } })

/**
 * `sales.web-order-keep` (Ghi dieu khach ke tu web): the agent reads the website request (meaning, so `ctx.agent.run`, no tool) and the
 * node keeps it on the customer: the consult stage on the declared `blocks-core.sales.lead` record (`nivo.tool.record.update`), the facts the
 * request names in the memory of the contact the run serves (`nivo.tool.contact.memory.remember`, only when it names any). Split from
 * `sales.web-order`; the team notice is `sales.web-order-notice`.
 */
export const salesWebOrderKeepNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: { key: "nodeSalesWebOrderKeepTitle" },
    description: { vi: "Ghi l\u1ea1i \u0111i\u1ec1u kh\u00e1ch k\u1ec3 trong y\u00eau c\u1ea7u t\u1eeb website v\u00e0o h\u1ed3 s\u01a1 kh\u00e1ch: giai \u0111o\u1ea1n t\u01b0 v\u1ea5n v\u00e0 nh\u1eefng th\u00f4ng tin kh\u00e1ch n\u00eau.", en: "Keeps what the customer said in the website request on their file: the consult stage and the details they gave." },
    tools: [TOOL.contactMemoryRemember],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const reading = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE}`,
            input: { request: given.request },
            output: readingSchema,
            tools: [],
            maxTurns: 1,
        })
        const staged = await context.tools.call(TOOL.recordUpdate, STAGE_OF(given.leadId, reading.consultStage))
        if (!staged.ok) return { leadId: given.leadId, kept: false, refusal: staged.declined === true ? "declined" : staged.refusal }
        const facts = namedFactsOf(reading.facts)
        if (Object.keys(facts).length === 0) return { leadId: given.leadId, kept: true, refusal: null }
        const remembered = await context.tools.call(TOOL.contactMemoryRemember, { facts })
        return remembered.ok
            ? { leadId: given.leadId, kept: true, refusal: null }
            : { leadId: given.leadId, kept: false, refusal: remembered.declined === true ? "declined" : remembered.refusal }
    },
    examples: [
        {
            name: "keeps what the request tells on the customer",
            params: {},
            input: { leadId: "lead-1", request: "2 gi\u1ecf nh\u1ecf giao t\u1edbi 25 Nguy\u1ec5n Hu\u1ec7" },
            tools: [
                {
                    id: TOOL.recordUpdate,
                    args: STAGE_OF("lead-1", READING.consultStage),
                    answer: answered({
                        record: {
                            id: "lead-1",
                            version: "2",
                            createdAt: "2026-11-01T00:00:00.000Z",
                            updatedAt: "2026-11-02T00:00:00.000Z",
                            values: { consultStage: READING.consultStage },
                        },
                    }),
                },
                {
                    id: TOOL.contactMemoryRemember,
                    args: { facts: READING.facts },
                    answer: answered({ remembered: ["address"], contactId: "contact-1" }),
                },
            ],
            agent: [{ answer: READING }],
            output: { leadId: "lead-1", kept: true, refusal: null },
        },
        {
            name: "a person declined the write on its card: the step says so, the team is still told",
            params: {},
            input: { leadId: "lead-1", request: "2 gi\u1ecf nh\u1ecf giao t\u1edbi 25 Nguy\u1ec5n Hu\u1ec7" },
            tools: [{ id: TOOL.recordUpdate, args: STAGE_OF("lead-1", READING.consultStage), answer: refused("declined") }],
            agent: [{ answer: READING }],
            output: { leadId: "lead-1", kept: false, refusal: "declined" },
        },
    ],
})
