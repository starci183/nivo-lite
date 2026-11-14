import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { SALES_LEAD_ENTITY } from "../../../shared/entities/sales-entity-names"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused } from "../../../shared/nodes/tool-answers"
import { saleLeadListOf, saleLeadOf } from "./care.reads"

const ID = "sales.web-order-lead"

/** The person the website met and what they asked. */
export interface WebOrderLeadInput {
    /** The core contact the website met (`= trigger.contactId`). */
    readonly contactId: string
    /** What the visitor asked for, free text (`= trigger.request`). */
    readonly request: string
    /** The name the form gave, or null. */
    readonly name: string | null
}

/** The sale's own record of the person. */
export interface WebOrderLeadFound {
    /** False: the record was found or made. */
    readonly declined: false
    /** The sale's record of the person (its id), found or made. */
    readonly leadId: string
    /** True when the record was made now, false when the sale already kept one. */
    readonly created: boolean
}

/** What a person's decline of a write leaves: no record, nothing written. */
export interface WebOrderLeadDeclined {
    /** True when a person declined writing the record on its card: nothing was written; the graph ends `declined`. */
    readonly declined: true
    /** Always null: no lead was created. */
    readonly leadId: null
    /** Always false: a person declined, so nothing was created. */
    readonly created: false
}

/** The record, or the declined form: a union on `declined`, so a graph that routes the decline away reads `leadId` as present. */
export type WebOrderLeadOutput = WebOrderLeadFound | WebOrderLeadDeclined

const input: NodeSchema<WebOrderLeadInput> = z.object({
    contactId: z.string().max(MAX_ID).min(1),
    request: z.string().max(MAX_BODY),
    name: z.string().max(MAX_LINE).nullable(),
})

const output: NodeSchema<WebOrderLeadOutput> = z.discriminatedUnion("declined", [
    z.object({
        declined: z.literal(false).describe("False: the record was found or made."),
        leadId: z.string().max(MAX_ID).min(1).describe("The id of the sale's record of the person."),
        created: z.boolean().describe("True when the record was made now, false when the sale already kept one."),
    }),
    z.object({
        declined: z.literal(true).describe("True when a person declined writing the record on its card: nothing was written."),
        leadId: z.null(),
        created: z.literal(false),
    }),
])

/** The record create of a person the sale does not know yet. Phone and email are claims on the contact, never written here. */
const CREATE_OF = (given: WebOrderLeadInput) => ({
    type: SALES_LEAD_ENTITY,
    values: { contactId: given.contactId, contactName: given.name ?? "website", channel: "website", need: given.request },
})

/** The record update that keeps the latest request on the record the sale already has. */
const UPDATE_OF = (given: WebOrderLeadInput, id: string) => ({ type: SALES_LEAD_ENTITY, id, patch: { need: given.request } })

/** What the step answers when a person declined a write on its card: no record, nothing written. */
const DECLINED: WebOrderLeadOutput = { leadId: null, created: false, declined: true as const }

const createdIdShape = z.object({ record: z.object({ id: z.string().min(1).max(MAX_ID) }) })

const GIVEN: WebOrderLeadInput = { contactId: "contact-1", request: "2 gi\u1ecf nh\u1ecf giao t\u1edbi 25 Nguy\u1ec5n Hu\u1ec7", name: "Lan" }
const LIST = saleLeadListOf("contact-1")
const ONE = { records: [{ id: "lead-1" }] }
const NONE = { records: [] }
const RECORD = (id: string) => ({
    record: { id, version: "1", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", values: {} },
})

/**
 * `sales.web-order-lead` (Tim hoac lap ho so khach): the website wake carries the CORE contact the visitor was met as, never a record of
 * the sale. This first step finds the sale's own record of that contact (`contactId` list, served by the type's `contact_key`) and makes it
 * when absent, else keeps the latest request on it; later steps use its id. Phone and email are NOT written: they are unverified claims on
 * the contact (the notice reads them from the wake), and the type's unique `phone_key` / `email_key` would refuse a number another record
 * holds. Two forms racing: a create refused `taken` (the record tool's answer to a unique constraint; the only one this create can meet is
 * the type's `contact_key`, since it writes no phone or email) lists again and updates the one found. A person declining a write on its
 * card (mode `ask`) is a business outcome: `declined: true`, no lead, the graph tells the team and ends `declined`. Any other refusal stops the run with
 * it (the engine tells the team); nothing is decided here, no model call.
 */
export const salesWebOrderLeadNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: { key: "nodeSalesWebOrderLeadTitle" },
    description: { vi: "T\u00ecm h\u1ed3 s\u01a1 b\u00e1n h\u00e0ng c\u1ee7a kh\u00e1ch \u0111\u1eb7t t\u1eeb website, ch\u01b0a c\u00f3 th\u00ec l\u1eadp m\u1edbi, c\u00f3 r\u1ed3i th\u00ec c\u1eadp nh\u1eadt y\u00eau c\u1ea7u m\u1edbi nh\u1ea5t.", en: "Finds the sales file of a customer who ordered on the website, creates it if missing, or updates it with the latest request." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: async (given, context) => {
        const found = await saleLeadOf(context, given.contactId)
        if (found !== null) {
            const kept = await context.tools.call(TOOL.recordUpdate, UPDATE_OF(given, found))
            if (!kept.ok && kept.declined === true) return DECLINED
            if (!kept.ok) return context.fail({ kind: "cannot", why: `${TOOL.recordUpdate} refused: ${kept.refusal}` }, kept.facts)
            return { leadId: found, created: false, declined: false as const }
        }
        const made = await context.tools.call(TOOL.recordCreate, CREATE_OF(given))
        if (made.ok) {
            const id = createdIdShape.safeParse(made.value)
            if (!id.success) return context.fail({ kind: "cannot", why: `${TOOL.recordCreate} answered an unknown shape` })
            return { leadId: id.data.record.id, created: true, declined: false as const }
        }
        // The record tool answers `taken` when a unique constraint held: here only the contact's (no phone or email is written).
        if (made.declined === true) return DECLINED
        if (made.refusal !== "taken")
            return context.fail({ kind: "cannot", why: `${TOOL.recordCreate} refused: ${made.refusal}` }, made.facts)
        const raced = await saleLeadOf(context, given.contactId)
        if (raced === null)
            return context.fail({ kind: "cannot", why: `${TOOL.recordCreate} refused: taken, yet no record is listed` })
        const kept = await context.tools.call(TOOL.recordUpdate, UPDATE_OF(given, raced))
        if (!kept.ok && kept.declined === true) return DECLINED
        if (!kept.ok) return context.fail({ kind: "cannot", why: `${TOOL.recordUpdate} refused: ${kept.refusal}` }, kept.facts)
        return { leadId: raced, created: false, declined: false as const }
    },
    examples: [
        {
            name: "the sale knows nobody of this contact: it makes the record from the website request",
            params: {},
            input: GIVEN,
            tools: [
                { id: TOOL.recordList, args: LIST, answer: answered(NONE) },
                { id: TOOL.recordCreate, args: CREATE_OF(GIVEN), answer: answered(RECORD("lead-1")) },
            ],
            output: { leadId: "lead-1", created: true, declined: false },
        },
        {
            name: "the sale already has a record of the contact: it keeps the latest request on it",
            params: {},
            input: GIVEN,
            tools: [
                { id: TOOL.recordList, args: LIST, answer: answered(ONE) },
                { id: TOOL.recordUpdate, args: UPDATE_OF(GIVEN, "lead-1"), answer: answered(RECORD("lead-1")) },
            ],
            output: { leadId: "lead-1", created: false, declined: false },
        },
        {
            name: "two forms raced and the create was refused taken (the contact's record exists): it lists again and updates the one found",
            params: {},
            input: GIVEN,
            tools: [
                { id: TOOL.recordList, args: LIST, answer: answered(NONE) },
                { id: TOOL.recordCreate, args: CREATE_OF(GIVEN), answer: refused("taken") },
                { id: TOOL.recordList, args: LIST, answer: answered(ONE) },
                { id: TOOL.recordUpdate, args: UPDATE_OF(GIVEN, "lead-1"), answer: answered(RECORD("lead-1")) },
            ],
            output: { leadId: "lead-1", created: false, declined: false },
        },
        {
            name: "any other refusal of the create stops the run with it, echoed",
            params: {},
            input: GIVEN,
            tools: [
                { id: TOOL.recordList, args: LIST, answer: answered(NONE) },
                { id: TOOL.recordCreate, args: CREATE_OF(GIVEN), answer: refused("invalid_value") },
            ],
            failure: { kind: "cannot", why: `${TOOL.recordCreate} refused: invalid_value` },
        },
        {
            name: "a person declines the update of the record the sale already has: nothing is written and the node says declined",
            params: {},
            input: GIVEN,
            tools: [
                { id: TOOL.recordList, args: LIST, answer: answered(ONE) },
                { id: TOOL.recordUpdate, args: UPDATE_OF(GIVEN, "lead-1"), answer: refused("declined") },
            ],
            output: { leadId: null, created: false, declined: true },
        },
        {
            name: "a person declines the creation of the record: nothing is written and the node says declined",
            params: {},
            input: GIVEN,
            tools: [
                { id: TOOL.recordList, args: LIST, answer: answered(NONE) },
                { id: TOOL.recordCreate, args: CREATE_OF(GIVEN), answer: refused("declined") },
            ],
            output: { leadId: null, created: false, declined: true },
        },
        {
            name: "two forms raced and a person declines the update of the record found: nothing is written and the node says declined",
            params: {},
            input: GIVEN,
            tools: [
                { id: TOOL.recordList, args: LIST, answer: answered(NONE) },
                { id: TOOL.recordCreate, args: CREATE_OF(GIVEN), answer: refused("taken") },
                { id: TOOL.recordList, args: LIST, answer: answered(ONE) },
                { id: TOOL.recordUpdate, args: UPDATE_OF(GIVEN, "lead-1"), answer: refused("declined") },
            ],
            output: { leadId: null, created: false, declined: true },
        },
    ],
})
