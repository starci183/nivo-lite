import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { DataRight } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import { nodeGoalOf } from "../node-ui"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { agentAnswer } from "./care.steps"

const ID = "sales.web-order"

/** What the website form gave: the customer, how to reach them, and their request in their own words. */
export interface WebOrderInput {
    /** The customer the form made (`= trigger.leadId`). */
    readonly leadId: string
    /** What the customer asked for, free text (`= trigger.request`). */
    readonly request: string
    /** The phone the customer left, or null. */
    readonly phone: string | null
    /** The email the customer left, or null. */
    readonly email: string | null
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** What the step left for the team. */
export interface WebOrderOutput {
    /** The customer, echoed. */
    readonly leadId: string
    /** One line for the team: who, what they want, how to call them. */
    readonly summary: string
}

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<WebOrderInput> = z.object({
    leadId: z.string().max(MAX_ID).min(1),
    request: z.string().max(MAX_BODY),
    phone: z.string().max(MAX_LINE).nullable(),
    email: z.string().max(MAX_LINE).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<WebOrderOutput> = z.object({
    leadId: z.string().max(MAX_ID).describe("The id of the customer, as given."),
    summary: z
        .string()
        .min(1)
        .max(MAX_LINE)
        .describe("One line for the team in its language: what the customer wants and how to reach them. No price or total."),
})

const CATALOGUE_FIELDS = ["id", "name", "active"] as const
const CATALOGUE_LIMIT = 500

const READ_CATALOGUE: DataRight = {
    kind: "catalogue-item",
    access: "read",
    scope: "workspace",
    fields: [...CATALOGUE_FIELDS],
}

/** A catalogue product as the agent is shown it: names only, so it never types a price. */
interface CatalogueRow {
    readonly id: string
    readonly name: string
    readonly active: boolean
}

const GUIDANCE =
    "The customer wrote through the website form, so nobody can answer them in a chat: the team calls them back. First keep what the " +
    "request tells on the customer (`lead.update` with `consultStage` and `consultFacts`: who it is for, the occasion, the time, the " +
    "address, the catalogue products named by id with their quantity). Then tell the team on the team chat, in one `message.text` with " +
    "intent `ask`, in the team's language (`locale`), to call the customer to confirm the order: who, what they asked for, the products " +
    "matched, the phone or email. Never type a price or a total."

const LEAD_UPDATE = {
    leadId: "lead-1",
    consultStage: "close",
    consultFacts: { address: "25 Nguyễn Huệ", picks: [{ catalogueItemId: "c1", quantity: 2 }] },
}

const NOTICE = {
    kind: "message.text",
    intent: "ask",
    title: "Đơn web mới: gọi xác nhận",
    text: "Khách đặt 2 Giỏ nhỏ giao tới 25 Nguyễn Huệ qua website. Gọi 0900000000 để xác nhận đơn.",
}

/**
 * `sales.web-order` (Đọc yêu cầu, báo đội gọi khách): a customer wrote through the website form. The agent reads their request against
 * the catalogue, keeps what it tells on the customer (`lead.update`), and tells the team on /chat to call the customer back to confirm
 * (`agent-message.post`). No work item, nothing to the customer (there is no chat to answer in).
 */
export const salesWebOrderNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeSalesWebOrderTitle"),
    params,
    input,
    output,
    rights: [READ_CATALOGUE],
    effects: [TOOL.leadUpdate, TOOL.teamMessagePost],
    requires: [TOOL.teamMessagePost],
    run: async (given, context) => {
        const rows = await context.data.read<CatalogueRow>("catalogue-item", {
            fields: [...CATALOGUE_FIELDS],
            limit: CATALOGUE_LIMIT,
        })
        return agentAnswer(context, {
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE}`,
            input: {
                ...given,
                catalogue: rows.filter((row) => row.active).map((row) => ({ catalogueItemId: row.id, name: row.name })),
            },
            output,
            maxTurns: 4,
            purpose: "web-order",
        })
    },
    examples: [
        {
            name: "keeps what the request tells and asks the team to call the customer back",
            params: {},
            input: {
                leadId: "lead-1",
                request: "2 giỏ nhỏ giao tới 25 Nguyễn Huệ",
                phone: "0900000000",
                email: null,
                locale: "vi",
            },
            output: { leadId: "lead-1", summary: "Khách web đặt 2 Giỏ nhỏ, gọi 0900000000 để xác nhận" },
            grant: {
                rights: [
                    READ_CATALOGUE,
                    { kind: "sales-lead", access: "write", scope: "turn", fields: ["consultStage", "consultFacts"] },
                ],
            },
            model: [
                { call: { tool: TOOL.leadUpdate, args: LEAD_UPDATE } },
                { call: { tool: TOOL.teamMessagePost, args: NOTICE } },
                { done: { leadId: "lead-1", summary: "Khách web đặt 2 Giỏ nhỏ, gọi 0900000000 để xác nhận" } },
            ],
            effects: [
                { kind: TOOL.leadUpdate, payload: LEAD_UPDATE },
                { kind: TOOL.teamMessagePost, payload: NOTICE },
            ],
            store: { "catalogue-item": [{ id: "c1", name: "Giỏ nhỏ", active: true }] },
        },
    ],
})
