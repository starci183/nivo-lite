import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { idSchema, jsonText } from "./books-shapes"
import { crmOk, refused } from "./books.fixtures"
import { webbooksText } from "../../modules/webbooks/copy"

/**
 * The match the step records: the request and the bank row that pays it. The settle step names a request on this route (its output
 * says so) but a route does not narrow a ref: the id is typed nullable and a null one is refused exactly.
 */
const input = z.object({ renewalId: idSchema.nullable(), transactionRef: idSchema })

/**
 * What the step did: the request it recorded and the state the CRM answered; or, when a person declined the record (`declined`
 * true: a decision about money, the graph tells the team and ends `declined`), the request it was about and no state.
 */
const output = z.object({
    renewalId: idSchema.describe("The `id` of the request the CRM answered (the request given, when declined)."),
    state: z
        .string()
        .min(1)
        .max(40)
        .nullable()
        .describe("The request's `state` exactly as the CRM answered it; null when declined."),
    declined: z.boolean().describe("True when a person declined the record."),
})

const RENEWAL_ID = "5b0f3c1e-2d4a-4e6b-8c7d-9a0b1c2d3e4f"

/**
 * `webbooks.renewal-paid` (Record the renewal paid): split from `webbooks.payment-record`. ONE CRM write,
 * `renewal.payment.record`, by the request's id and the bank row's id: it takes no amount, the bank row is the proof. No
 * AI call (the old agent only copied the call and its answer). The CRM refuses a request in another state or a bank row already
 * used: a fact the node cannot go past (the engine reports it). A person who declines the record (money) made a decision: the node
 * returns it (`declined` true) and the graph tells the team and ends `declined` (no team line, no hand-off). Blocking.
 */
export const webbooksRenewalPaidNode: TemplateNode = defineTemplateNode({
    id: "webbooks.renewal-paid",
    title: webbooksText("node.renewal-paid.title"),
    description: { vi: "Ghi nh\u1eadn kho\u1ea3n ti\u1ec1n \u0111\u00e3 nh\u1eadn v\u00e0o y\u00eau c\u1ea7u gia h\u1ea1n v\u00e0 chuy\u1ec3n sang \u0111\u00e3 tr\u1ea3.", en: "Records the received payment on the renewal request and marks it paid." },
    tools: [CRM_NIVOWEB.post_renewals_id_payments],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    run: async (given, ctx) => {
        if (given.renewalId === null) return ctx.fail({ kind: "cannot", why: "no_renewal_named" })
        const recorded = await ctx.tools.call(CRM_NIVOWEB.post_renewals_id_payments, {
            id: given.renewalId,
            transactionRef: given.transactionRef,
        })
        if (!recorded.ok && recorded.declined === true)
            return { renewalId: given.renewalId, state: null, declined: true }
        if (!recorded.ok)
            return ctx.fail({ kind: "cannot", why: `renewal_payment_refused:${recorded.refusal}` }, recorded.facts)
        return { renewalId: jsonText(recorded.value["id"]), state: jsonText(recorded.value["state"]), declined: false }
    },
    examples: [
        {
            name: "records the request paid by the bank row's id",
            params: {},
            input: { renewalId: RENEWAL_ID, transactionRef: "tx-0077" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals_id_payments,
                    args: { id: RENEWAL_ID, transactionRef: "tx-0077" },
                    answer: crmOk({ id: RENEWAL_ID, state: "paid" }),
                },
            ],
            output: { renewalId: RENEWAL_ID, state: "paid", declined: false },
        },
        {
            name: "the bank row already paid another request: the CRM refuses, the node cannot go on",
            params: {},
            input: { renewalId: RENEWAL_ID, transactionRef: "tx-0077" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals_id_payments,
                    args: { id: RENEWAL_ID, transactionRef: "tx-0077" },
                    answer: refused("transaction_already_used"),
                },
            ],
            failure: { kind: "cannot", why: "renewal_payment_refused:transaction_already_used" },
        },
        {
            name: "a person declines the record: nothing recorded, declined returned (the graph tells the team, ends declined)",
            params: {},
            input: { renewalId: RENEWAL_ID, transactionRef: "tx-0077" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals_id_payments,
                    args: { id: RENEWAL_ID, transactionRef: "tx-0077" },
                    answer: refused("declined"),
                },
            ],
            output: { renewalId: RENEWAL_ID, state: null, declined: true },
        },
        {
            name: "no request reached the step: nothing is recorded, the node cannot go on",
            params: {},
            input: { renewalId: null, transactionRef: "tx-0077" },
            failure: { kind: "cannot", why: "no_renewal_named" },
        },
    ],
})
