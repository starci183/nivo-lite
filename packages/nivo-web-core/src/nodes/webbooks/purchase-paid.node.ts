import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { idSchema, jsonText } from "./books-shapes"
import { crmOk, refused } from "./books.fixtures"
import { webbooksText } from "../../modules/webbooks/copy"

/**
 * The match the step records: the purchase and the bank row that pays it. The settle step names a purchase on this route (its
 * output says so) but a route does not narrow a ref: the id is typed nullable and a null one is refused exactly.
 */
const input = z.object({ purchaseId: idSchema.nullable(), transactionRef: idSchema })

/**
 * What the step did: the purchase it recorded, its code, and the state the CRM answered; or, when a person declined the record
 * (`declined` true: a decision about money, the graph tells the team and ends `declined`), the purchase it was about and no code or
 * state.
 */
const output = z.object({
    purchaseId: idSchema.describe("The `id` of the purchase the CRM answered (the purchase given, when declined)."),
    code: idSchema.nullable().describe("The purchase's `code`, as the CRM answered it; null when declined."),
    state: z
        .string()
        .min(1)
        .max(40)
        .nullable()
        .describe("The purchase's `state` exactly as the CRM answered it; null when declined."),
    declined: z.boolean().describe("True when a person declined the record."),
})

const PURCHASE_ID = "7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f"

/** The purchase as `purchase.payment.record` answers it: paid by the bank row. */
const RECORDED = {
    id: PURCHASE_ID,
    code: "MUA-0007",
    state: "paid",
    channel: "zalo",
    sourceRef: "c-0002",
    need: "Thiet ke website ban hang",
    contactName: "Anh Minh",
    phone: null,
    email: null,
    domain: "minhshop.vn",
    customerCode: "KH-0142",
    quote: null,
    paymentCode: "MUA7Q2",
    transactionRef: "tx-0090",
    paidAt: "2026-11-12",
    acceptedAt: "2026-11-11",
    projectCode: "DA-2026-007",
    contractNo: "HD-2026-007",
    note: null,
    followUps: [],
}

/**
 * `webbooks.purchase-paid` (Record the purchase paid): split from `webbooks.purchase-record`, the twin of `webbooks.renewal-paid`
 * for the second kind of open request. ONE CRM write, `purchase.payment.record`, by the purchase's id and the bank row's
 * id. No AI call. A refusal (another state, a bank row already used) is a fact the node cannot go past. A person who declines the
 * record (money) made a decision: the node returns it (`declined` true) and the graph tells the team and ends `declined` (no team
 * line, no hand-off). Blocking. Its output carries the purchase's code for the team line.
 */
export const webbooksPurchasePaidNode: TemplateNode = defineTemplateNode({
    id: "webbooks.purchase-paid",
    title: webbooksText("node.purchase-paid.title"),
    description: { vi: "Ghi nh\u1eadn kho\u1ea3n ti\u1ec1n \u0111\u00e3 nh\u1eadn v\u00e0o \u0111\u01a1n mua v\u00e0 chuy\u1ec3n \u0111\u01a1n sang \u0111\u00e3 tr\u1ea3.", en: "Records the received payment on the purchase and marks it paid." },
    tools: [CRM_NIVOWEB.post_purchases_id_payments],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    run: async (given, ctx) => {
        if (given.purchaseId === null) return ctx.fail({ kind: "cannot", why: "no_purchase_named" })
        const recorded = await ctx.tools.call(CRM_NIVOWEB.post_purchases_id_payments, {
            id: given.purchaseId,
            transactionRef: given.transactionRef,
        })
        if (!recorded.ok && recorded.declined === true)
            return { purchaseId: given.purchaseId, code: null, state: null, declined: true }
        if (!recorded.ok)
            return ctx.fail({ kind: "cannot", why: `purchase_payment_refused:${recorded.refusal}` }, recorded.facts)
        return {
            purchaseId: jsonText(recorded.value["id"]),
            code: jsonText(recorded.value["code"]),
            state: jsonText(recorded.value["state"]),
            declined: false,
        }
    },
    examples: [
        {
            name: "records the purchase paid by the bank row's id",
            params: {},
            input: { purchaseId: PURCHASE_ID, transactionRef: "tx-0090" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_payments,
                    args: { id: PURCHASE_ID, transactionRef: "tx-0090" },
                    answer: crmOk(RECORDED),
                },
            ],
            output: { purchaseId: PURCHASE_ID, code: "MUA-0007", state: "paid", declined: false },
        },
        {
            name: "the purchase is no longer awaiting payment: the CRM refuses, the node cannot go on",
            params: {},
            input: { purchaseId: PURCHASE_ID, transactionRef: "tx-0090" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_payments,
                    args: { id: PURCHASE_ID, transactionRef: "tx-0090" },
                    answer: refused("purchase_not_awaiting_payment"),
                },
            ],
            failure: { kind: "cannot", why: "purchase_payment_refused:purchase_not_awaiting_payment" },
        },
        {
            name: "a person declines the record: nothing recorded, declined returned (the graph tells the team, ends declined)",
            params: {},
            input: { purchaseId: PURCHASE_ID, transactionRef: "tx-0090" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_payments,
                    args: { id: PURCHASE_ID, transactionRef: "tx-0090" },
                    answer: refused("declined"),
                },
            ],
            output: { purchaseId: PURCHASE_ID, code: null, state: null, declined: true },
        },
        {
            name: "no purchase reached the step: nothing is recorded, the node cannot go on",
            params: {},
            input: { purchaseId: null, transactionRef: "tx-0090" },
            failure: { kind: "cannot", why: "no_purchase_named" },
        },
    ],
})
