import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import { AWAITING_PAYMENT_STATUSES } from "../../rules/sales/order-status"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { SALES_ORDER_ENTITY } from "../../entities/sales/sales-entity-names"

/** The customer's words that they paid. */
export interface PaidClaimNoticeInput {
    /** The customer, or null while the conversation has none (then no order is read). */
    readonly contactId: string | null
    /** What the customer said; null only when the graph is wired wrongly. */
    readonly text: string | null
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** What the team was told. */
export interface PaidClaimNoticeOutput {
    /** The codes of the customer's orders that still wait for their money, newest first. */
    readonly awaiting: ReadonlyArray<string>
    /** True once the notice was posted. */
    readonly posted: boolean
    /** The post's refusal when it was refused, else null. */
    readonly refusal: string | null
}

/** The most orders of the person the notice names. */
const AWAITING_MAX = 5

const input: NodeSchema<PaidClaimNoticeInput> = z.object({
    contactId: z.string().min(1).max(MAX_ID).nullable(),
    text: z.string().min(1).max(MAX_BODY).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<PaidClaimNoticeOutput> = z.object({
    awaiting: z.array(z.string().min(1).max(MAX_ID)).max(AWAITING_MAX).describe("The codes of the customer's orders that still wait for their money."),
    posted: z.boolean().describe("True once the notice was posted to the team."),
    refusal: z.string().max(MAX_ID).nullable().describe("The post tool's refusal when it refused, else null."),
})

/**
 * The record list of the person's orders that still wait for their money (`nivo.tool.record.list` on the sale's own orders: the status an
 * exact filter), newest first; the type's `contact_status_recent` index serves it.
 */
export const awaitingOfContact = (contactId: string): JsonObject => ({
    type: SALES_ORDER_ENTITY,
    where: {
        op: "and",
        of: [
            { op: "eq", field: "contactId", value: contactId },
            { op: "in", field: "status", values: [...AWAITING_PAYMENT_STATUSES] },
        ],
    },
    order: [["createdAt", "desc"]],
    limit: AWAITING_MAX,
    fields: ["orderNo"],
})

/** One page of the record list. */
const pageShape = z.object({
    records: z.array(z.object({ id: z.string().min(1).max(MAX_ID), values: z.object({ orderNo: z.string().min(1).max(MAX_ID) }) })).max(AWAITING_MAX),
})

/** The post as `nivo.tool.team.message.post` takes it: one catalogue line telling (`notify`) the founder of the claim. */
const noticeOf = (given: PaidClaimNoticeInput & { readonly text: string }, awaiting: ReadonlyArray<string>): JsonObject => ({
    kind: "message.text",
    intent: "notify",
    audience: "founder",
    title: messageOf(given.locale, "nodeSalesPaidClaimNoticeHeading"),
    text: messageOf(given.locale, awaiting.length === 0 ? "nodeSalesPaidClaimNoticeLineNone" : "nodeSalesPaidClaimNoticeLine")
        .replaceAll("{text}", given.text)
        .replaceAll("{orders}", awaiting.join(", ")),
})

/** The claim of the examples. */
const CLAIM: PaidClaimNoticeInput & { readonly text: string } = { contactId: "contact-1", text: "I transferred for DH-20261113-0001", locale: "en" }

/**
 * `sales.paid-claim-notice` (Bao doi khach bao da chuyen): tells the founder on /chat that a customer says they paid, with the customer's
 * own words and the codes of the person's orders that still wait for their money (`nivo.tool.record.list` on the sale's own orders by
 * `contactId`; waiting = an exact filter on the status). Nothing is settled on the customer's words: the bank's credit settles. One catalogue line,
 * no AI call. A side step (`blocking: false`): a notice that cannot be posted is said in the output.
 */
export const salesPaidClaimNoticeNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.paid-claim-notice",
    title: bilingualOf("nodeSalesPaidClaimNoticeTitle"),
    description: { vi: "B\u00e1o \u0111\u1ed9i khi kh\u00e1ch n\u00f3i \u0111\u00e3 chuy\u1ec3n ti\u1ec1n, k\u00e8m l\u1eddi kh\u00e1ch v\u00e0 c\u00e1c \u0111\u01a1n c\u1ee7a h\u1ecd c\u00f2n ch\u1edd ti\u1ec1n. Ti\u1ec1n ch\u1ec9 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn khi ng\u00e2n h\u00e0ng b\u00e1o.", en: "Tells the team when a customer says they paid, with their words and their orders still waiting for money. Money is only confirmed when the bank reports it." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    input,
    output,
    blocking: false,
    run: async (given, context) => {
        const { text } = given
        if (text === null) return context.fail({ kind: "cannot", why: "the notice was reached with no words of the customer" })
        const listed =
            given.contactId === null
                ? { records: [] }
                : pageShape.safeParse(
                      valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, awaitingOfContact(given.contactId))),
                  ).data
        if (listed === undefined) return context.fail({ kind: "cannot", why: `${TOOL.recordList} answered an unknown shape` })
        const awaiting = listed.records.map((record) => record.values.orderNo)
        const posted = await context.tools.call(TOOL.teamMessagePost, noticeOf({ ...given, text }, awaiting))
        return posted.ok
            ? { awaiting: [...awaiting], posted: true, refusal: null }
            : { awaiting: [...awaiting], posted: false, refusal: posted.declined === true ? "declined" : posted.refusal }
    },
    examples: [
        {
            name: "the founder is told the customer's words and the code of the order that still waits for its money",
            params: {},
            input: CLAIM,
            tools: [
                {
                    id: TOOL.recordList,
                    args: awaitingOfContact("contact-1"),
                    answer: answered({ records: [{ id: "o1", values: { orderNo: "DH-20261113-0001" } }], next: null }),
                },
                {
                    id: TOOL.teamMessagePost,
                    args: noticeOf(CLAIM, ["DH-20261113-0001"]),
                    answer: answered({ messageId: "team-message-1" }),
                },
            ],
            output: { awaiting: ["DH-20261113-0001"], posted: true, refusal: null },
        },
        {
            name: "a conversation with no customer yet reads no order; the founder is told the words alone",
            params: {},
            input: { ...CLAIM, contactId: null },
            tools: [
                {
                    id: TOOL.teamMessagePost,
                    args: noticeOf({ ...CLAIM, contactId: null }, []),
                    answer: answered({ messageId: "team-message-1" }),
                },
            ],
            output: { awaiting: [], posted: true, refusal: null },
        },
        {
            name: "a notice the chat refuses is said in the output",
            params: {},
            input: CLAIM,
            tools: [
                {
                    id: TOOL.recordList,
                    args: awaitingOfContact("contact-1"),
                    answer: answered({ records: [{ id: "o1", values: { orderNo: "DH-20261113-0001" } }], next: null }),
                },
                { id: TOOL.teamMessagePost, args: noticeOf(CLAIM, ["DH-20261113-0001"]), answer: refused("other_room") },
            ],
            output: { awaiting: ["DH-20261113-0001"], posted: false, refusal: "other_room" },
        },
        {
            name: "reached with no words of the customer (a wiring fault): nothing is read or posted",
            params: {},
            input: { ...CLAIM, text: null },
            failure: { kind: "cannot", why: "the notice was reached with no words of the customer" },
        },
    ],
})
