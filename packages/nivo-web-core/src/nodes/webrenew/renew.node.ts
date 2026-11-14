import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewText } from "../../modules/webrenew/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { booleanOf, isDeclined, numberOf, textOf } from "./webrenew.calls"
import { RENEWAL_ID, crmAnswered, crmRefused } from "./webrenew.examples"

/** The paid renewal request the Accounting agent handed on. */
type RenewInput = {
    readonly renewalId: string
    readonly customerCode: string
    readonly serviceCode: string
    readonly termMonths: number
    readonly transactionRef: string
}

/** The state of a request, as the CRM answers it. */
export type RenewalState = "awaiting_payment" | "paid" | "pending_person" | "renewed" | "failed" | "cancelled"

const STATES: readonly [RenewalState, ...Array<RenewalState>] = [
    "awaiting_payment",
    "paid",
    "pending_person",
    "renewed",
    "failed",
    "cancelled",
]

/** What the step did: the request's state after the provider step, as the CRM answered it. */
export type RenewOutput = {
    /** The id of the renewal. */
    readonly renewalId: string
    /** The CRM code of the service this concerns; null when none is named. */
    readonly serviceCode: string
    /** The term in months; null when the CRM's own default applies. */
    readonly termMonths: number
    /** The state the record is in. */
    readonly state: RenewalState
    /** True when the CRM only checked the renewal and changed nothing. */
    readonly dryRun: boolean
    /** The day the service expires after the renewal (ISO date); null when it is not known. */
    readonly newExpiresOn: string | null
}

/**
 * What the step left: the renewal as the CRM answered it (`declined` false), or a person's decline of the renewal (`declined` true:
 * nothing renewed, the request as handed on, `state`, `dryRun` and `newExpiresOn` null). The graph routes `declined` to the team's
 * notice and the outcome `declined`; the next steps read the renewal only when it was not declined.
 */
export type RenewStepOutput = {
    /** True when a person declined the renewal. */
    readonly declined: boolean
    /** The id of the renewal. */
    readonly renewalId: string
    /** The CRM code of the service this concerns; null when none is named. */
    readonly serviceCode: string
    /** The term in months; null when the CRM's own default applies. */
    readonly termMonths: number
    /** The state of the renewal; null when it was declined. */
    readonly state: RenewalState | null
    /** True when the CRM only checked the renewal; null when it was declined. */
    readonly dryRun: boolean | null
    /** The day the service expires after the renewal; null when it is not known. */
    readonly newExpiresOn: string | null
}

const ID = "webrenew.renew"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<RenewInput> = z.object({
    renewalId: z.uuid(),
    customerCode: z.string().min(1).max(80),
    serviceCode: z.string().min(1).max(120),
    termMonths: z.number().int().min(1).max(120),
    transactionRef: z.string().min(1).max(200),
})

/** The schema of the request's state after the provider step. */
export const renewOutputSchema: z.ZodType<RenewOutput> = z.object({
    renewalId: z.uuid(),
    serviceCode: z.string().min(1).max(120),
    termMonths: z.number().int().min(1).max(120),
    state: z.enum(STATES),
    dryRun: z.boolean(),
    newExpiresOn: z.string().max(10).nullable(),
})
const output: z.ZodType<RenewStepOutput> = z.object({
    declined: z.boolean(),
    renewalId: z.uuid(),
    serviceCode: z.string().min(1).max(120),
    termMonths: z.number().int().min(1).max(120),
    state: z.enum(STATES).nullable(),
    dryRun: z.boolean().nullable(),
    newExpiresOn: z.string().max(10).nullable(),
})

/** The state a member of an answer names, or null when it is none of the CRM's states. */
const stateOf = (value: unknown): RenewalState | null => STATES.find((state) => state === value) ?? null

const REQUEST = {
    id: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    customerCode: "KH-001",
    provider: "manual",
    termMonths: 12,
    state: "paid",
    netVnd: 400_000,
    vatVnd: 40_000,
    totalVnd: 440_000,
    priceSource: "price_sheet",
    paymentCode: "GH12345",
    transactionRef: "bank-row-0001",
    paidAt: "2026-11-12T05:00:00.000Z",
    dryRun: true,
    plugin: "manual",
    providerRef: null,
    newExpiresOn: null,
}

const GIVEN: RenewInput = {
    renewalId: RENEWAL_ID,
    customerCode: "KH-001",
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    transactionRef: "bank-row-0001",
}

/**
 * `webrenew.renew` (Renew at the provider): ONE write, no AI call. The step reads the request and checks it EXACTLY
 * against what Accounting handed on (state `paid`, this service, this term, this transaction reference); any difference stops the
 * run with the facts (the engine asks the founder). Then it renews through the CRM (`nivo.api.crm.nivoweb.post.services.code.renewals`,
 * by itself, mode `auto`: the customer's payment is already recorded), which refuses an unpaid request anyway: no path renews before the money. Its
 * output is the CRM's answer. Today the provider step is `manual` and a dry run, so the request ends `pending_person`: a person
 * renews and confirms. A person who declines the renewal (a shop's own `ask`) made a decision, never a failure: nothing is renewed, the step RETURNS
 * `declined` true, and the graph tells the team and ends `declined` (the customer is told nothing, Accounting is not called).
 */
export const webrenewRenewNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.renew.title"),
    description: { vi: "Gia h\u1ea1n d\u1ecbch v\u1ee5 sau khi ti\u1ec1n \u0111\u00e3 v\u1ec1, ch\u1ec9 khi y\u00eau c\u1ea7u kh\u1edbp \u0111\u00fang kho\u1ea3n \u0111\u00e3 thanh to\u00e1n.", en: "Renews the service once the money has arrived, only when the request exactly matches the payment received." },
    tools: [CRM_NIVOWEB.get_renewals_id, CRM_NIVOWEB.post_services_code_renewals],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    run: async (given, context) => {
        const request = await context.tools.call(CRM_NIVOWEB.get_renewals_id, { id: given.renewalId })
        if (!request.ok)
            return context.fail({ kind: "cannot", why: `renewal_read_refused:${request.refusal}` }, request.facts)
        const payable =
            textOf(request.value, "state") === "paid" &&
            textOf(request.value, "serviceCode") === given.serviceCode &&
            numberOf(request.value, "termMonths") === given.termMonths &&
            textOf(request.value, "transactionRef") === given.transactionRef
        if (!payable) return context.fail({ kind: "cannot", why: "renewal_not_as_handed_on" }, request.value)
        const renewed = await context.tools.call(CRM_NIVOWEB.post_services_code_renewals, {
            code: given.serviceCode,
            renewalId: given.renewalId,
        })
        if (isDeclined(renewed)) {
            return {
                declined: true,
                renewalId: given.renewalId,
                serviceCode: given.serviceCode,
                termMonths: given.termMonths,
                state: null,
                dryRun: null,
                newExpiresOn: null,
            }
        }
        if (!renewed.ok)
            return context.fail({ kind: "cannot", why: `renewal_refused:${renewed.refusal}` }, renewed.facts)
        const state = stateOf(renewed.value["state"])
        const dryRun = booleanOf(renewed.value, "dryRun")
        if (state === null || dryRun === null)
            return context.fail({ kind: "cannot", why: "renewal_answered_incomplete" }, renewed.value)
        return {
            declined: false,
            renewalId: textOf(renewed.value, "id") ?? given.renewalId,
            serviceCode: textOf(renewed.value, "serviceCode") ?? given.serviceCode,
            termMonths: numberOf(renewed.value, "termMonths") ?? given.termMonths,
            state,
            dryRun,
            newExpiresOn: textOf(renewed.value, "newExpiresOn"),
        }
    },
    examples: [
        {
            name: "reads the paid request and renews it once through the CRM, answering the state as given",
            params: {},
            input: GIVEN,
            tools: [
                { id: CRM_NIVOWEB.get_renewals_id, args: { id: RENEWAL_ID }, answer: crmAnswered(REQUEST) },
                {
                    id: CRM_NIVOWEB.post_services_code_renewals,
                    args: { code: "EXAMPLE-TM", renewalId: RENEWAL_ID },
                    answer: crmAnswered({ ...REQUEST, state: "pending_person" }),
                },
            ],
            output: {
                declined: false,
                renewalId: RENEWAL_ID,
                serviceCode: "EXAMPLE-TM",
                termMonths: 12,
                state: "pending_person",
                dryRun: true,
                newExpiresOn: null,
            },
        },
        {
            name: "a request that is not paid is never renewed: the run stops with the facts",
            params: {},
            input: GIVEN,
            tools: [
                {
                    id: CRM_NIVOWEB.get_renewals_id,
                    args: { id: RENEWAL_ID },
                    answer: crmAnswered({ ...REQUEST, state: "awaiting_payment", transactionRef: null }),
                },
            ],
            failure: { kind: "cannot", why: "renewal_not_as_handed_on" },
        },
        {
            name: "a request paid by another transaction is never renewed",
            params: {},
            input: GIVEN,
            tools: [
                {
                    id: CRM_NIVOWEB.get_renewals_id,
                    args: { id: RENEWAL_ID },
                    answer: crmAnswered({ ...REQUEST, transactionRef: "bank-row-0002" }),
                },
            ],
            failure: { kind: "cannot", why: "renewal_not_as_handed_on" },
        },
        {
            name: "a renewal the CRM refuses stops the run",
            params: {},
            input: GIVEN,
            tools: [
                { id: CRM_NIVOWEB.get_renewals_id, args: { id: RENEWAL_ID }, answer: crmAnswered(REQUEST) },
                {
                    id: CRM_NIVOWEB.post_services_code_renewals,
                    args: { code: "EXAMPLE-TM", renewalId: RENEWAL_ID },
                    answer: crmRefused("renewal_not_paid"),
                },
            ],
            failure: { kind: "cannot", why: "renewal_refused:renewal_not_paid" },
        },
        {
            name: "a person declines the renewal: nothing is renewed, the step returns `declined` (their decision)",
            params: {},
            input: GIVEN,
            tools: [
                { id: CRM_NIVOWEB.get_renewals_id, args: { id: RENEWAL_ID }, answer: crmAnswered(REQUEST) },
                {
                    id: CRM_NIVOWEB.post_services_code_renewals,
                    args: { code: "EXAMPLE-TM", renewalId: RENEWAL_ID },
                    answer: crmRefused("declined"),
                },
            ],
            output: {
                declined: true,
                renewalId: RENEWAL_ID,
                serviceCode: "EXAMPLE-TM",
                termMonths: 12,
                state: null,
                dryRun: null,
                newExpiresOn: null,
            },
        },
    ],
})
