import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewText } from "../../modules/webrenew/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { type RenewOutput, renewOutputSchema } from "./renew.node"
import { isDeclined, textOf } from "./webrenew.calls"
import { RENEWAL_ID, crmAnswered, crmRefused } from "./webrenew.examples"

/** The renewal as the registrar step left it. */
type RenewRecordInput = {
    readonly renewal: RenewOutput
}

/** Whether the CRM recorded the answer, and the request's state after it; `recorded` false and `state` null when nothing was written. */
type RenewRecordOutput = {
    readonly recorded: boolean
    readonly state: string | null
}

const ID = "webrenew.renew-record"

/** Who confirms the outcome in the CRM: the Renewal agent. */
const CONFIRMED_BY = "webrenew"

/** The note of an order the registrar took whose end date did not move yet. */
const PROVIDER_PENDING = "provider_pending"

/** The note of a service no registrar tool renews (hosting, SSL, a provider with no tool): a person renews it by hand (R83). */
const AWAITING_MANUAL = "awaiting_manual_renewal"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<RenewRecordInput> = z.object({ renewal: renewOutputSchema })
const output: z.ZodType<RenewRecordOutput> = z.object({
    recorded: z.boolean().describe("True once the CRM recorded the registrar's answer."),
    state: z.string().min(1).max(40).nullable().describe("The request's `state` as the CRM answered it; null when nothing was written."),
})

/** The outcome body for a renewal the registrar answered: `renewed` with its date, else `pending` for a person (never `failed`). */
const bodyOf = (renewal: RenewOutput): Readonly<Record<string, string>> => {
    const ref = renewal.reference === null ? {} : { providerRef: renewal.reference }
    switch (renewal.outcome) {
        case "renewed":
            return {
                outcome: "renewed",
                ...ref,
                ...(renewal.newExpiresOn === null ? {} : { newExpiresOn: renewal.newExpiresOn }),
                confirmedBy: CONFIRMED_BY,
            }
        case "pending":
            return { outcome: "pending", ...ref, confirmedBy: CONFIRMED_BY, note: PROVIDER_PENDING }
        case "refused":
            return { outcome: "pending", confirmedBy: CONFIRMED_BY, ...(renewal.reason === null ? {} : { note: renewal.reason }) }
        case "not_renewable":
            return { outcome: "pending", confirmedBy: CONFIRMED_BY, note: AWAITING_MANUAL }
    }
}

const RENEWED: RenewOutput = {
    renewalId: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    outcome: "renewed",
    reason: null,
    reference: "INET-ORD-7781",
    provider: "inet",
    newExpiresOn: "2027-12-12",
    expiresBefore: "2026-12-12",
}

const PENDING: RenewOutput = { ...RENEWED, outcome: "pending", newExpiresOn: null }

const REFUSED: RenewOutput = {
    ...RENEWED,
    outcome: "refused",
    reason: "insufficient_balance",
    reference: null,
    provider: null,
    newExpiresOn: null,
    expiresBefore: null,
}

/** The request as the CRM answers the outcome write. */
const requestOf = (state: string, newExpiresOn: string | null) =>
    crmAnswered({
        id: RENEWAL_ID,
        serviceCode: "EXAMPLE-TM",
        customerCode: "KH-001",
        provider: "inet",
        termMonths: 12,
        state,
        providerRef: "INET-ORD-7781",
        newExpiresOn,
        confirmedBy: CONFIRMED_BY,
    })

/**
 * `webrenew.renew-record` (Record the provider answer, R57): ONE CRM write, no AI. It writes the registrar's answer on the paid request
 * (`nivo.api.crm.nivoweb.post.renewals.id.outcome`, mode `auto`: a record of what happened, it moves no money): `renewed` with the
 * reference and the new end date; `pending` (order taken) with the reference and the note `provider_pending`; a refusal as `pending`
 * with the refusal as the note (the customer has paid: a person finishes it, the agent never writes `failed`). A service no registrar
 * tool renews (hosting, SSL, R83) is recorded as `pending` with the note `awaiting_manual_renewal` (the team is told by the next step). A CRM refusal stops the run (the engine reports it; never silent). A person declining the write (a shop's
 * own `ask`) made a decision: nothing is recorded.
 */
export const webrenewRenewRecordNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.renewRecord.title"),
    description: {
        vi: "Ghi vào hệ thống khách hàng kết quả gia hạn mà nhà đăng ký trả lời.",
        en: "Records in the customer system what the registrar answered for the renewal.",
    },
    tools: [CRM_NIVOWEB.post_renewals_id_outcome],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    run: async (given, context) => {
        const body = bodyOf(given.renewal)
        const written = await context.tools.call(CRM_NIVOWEB.post_renewals_id_outcome, { id: given.renewal.renewalId, ...body })
        if (isDeclined(written)) return { recorded: false, state: null }
        if (!written.ok)
            return context.fail({ kind: "cannot", why: `renewal_record_refused:${written.refusal}` }, written.facts)
        return { recorded: true, state: textOf(written.value, "state") }
    },
    examples: [
        {
            name: "a renewed domain: the reference and the new end date recorded, the request is renewed",
            params: {},
            input: { renewal: RENEWED },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals_id_outcome,
                    args: {
                        id: RENEWAL_ID,
                        outcome: "renewed",
                        providerRef: "INET-ORD-7781",
                        newExpiresOn: "2027-12-12",
                        confirmedBy: CONFIRMED_BY,
                    },
                    answer: requestOf("renewed", "2027-12-12"),
                },
            ],
            output: { recorded: true, state: "renewed" },
        },
        {
            name: "an order the registrar took but has not moved: pending for a person, with the reference",
            params: {},
            input: { renewal: PENDING },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals_id_outcome,
                    args: {
                        id: RENEWAL_ID,
                        outcome: "pending",
                        providerRef: "INET-ORD-7781",
                        confirmedBy: CONFIRMED_BY,
                        note: PROVIDER_PENDING,
                    },
                    answer: requestOf("pending_person", null),
                },
            ],
            output: { recorded: true, state: "pending_person" },
        },
        {
            name: "a refused renewal waits for a person: pending with the refusal as the note, never failed",
            params: {},
            input: { renewal: REFUSED },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals_id_outcome,
                    args: { id: RENEWAL_ID, outcome: "pending", confirmedBy: CONFIRMED_BY, note: "insufficient_balance" },
                    answer: requestOf("pending_person", null),
                },
            ],
            output: { recorded: true, state: "pending_person" },
        },
        {
            name: "a service no registrar tool renews (hosting, SSL): recorded as awaiting manual renewal, pending for a person",
            params: {},
            input: { renewal: { ...REFUSED, outcome: "not_renewable", reason: "not_a_domain" } },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals_id_outcome,
                    args: { id: RENEWAL_ID, outcome: "pending", confirmedBy: CONFIRMED_BY, note: AWAITING_MANUAL },
                    answer: requestOf("pending_person", null),
                },
            ],
            output: { recorded: true, state: "pending_person" },
        },
        {
            name: "a CRM refusal of the write stops the run",
            params: {},
            input: { renewal: RENEWED },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals_id_outcome,
                    args: {
                        id: RENEWAL_ID,
                        outcome: "renewed",
                        providerRef: "INET-ORD-7781",
                        newExpiresOn: "2027-12-12",
                        confirmedBy: CONFIRMED_BY,
                    },
                    answer: crmRefused("renewal_not_paid"),
                },
            ],
            failure: { kind: "cannot", why: "renewal_record_refused:renewal_not_paid" },
        },
    ],
})
