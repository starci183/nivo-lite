import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewText } from "../../modules/webrenew/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { numberOf, recordsOf, textOf } from "./webrenew.calls"
import { RENEWAL_ID, crmAnswered, crmRefused } from "./webrenew.examples"

/** The paid renewal request the Accounting agent handed on. */
type RenewCheckInput = {
    readonly renewalId: string
    readonly customerCode: string
    readonly serviceCode: string
    readonly termMonths: number
    readonly transactionRef: string
}

/**
 * Why a paid renewal cannot be renewed at a registrar by a tool: the service is not in the customer's list, it is no domain (hosting
 * and SSL: no provider tool renews them today, R57-a), its provider is no registrar with a tool (`azwebsite`, `manual`), or the term is
 * not a whole number of years (a registrar renews by years).
 */
export type NotRenewableReason = "service_not_listed" | "not_a_domain" | "provider_has_no_tool" | "term_not_whole_years"

const REASONS: readonly [NotRenewableReason, ...Array<NotRenewableReason>] = [
    "service_not_listed",
    "not_a_domain",
    "provider_has_no_tool",
    "term_not_whole_years",
]

/**
 * What the check left: the request, and either what the registrar renews (`domain`, `years`, `reason` null) or why no registrar tool
 * renews it (`reason`, `domain` and `years` null). `provider` is the service's provider as the CRM lists it (null when not listed).
 */
export type RenewCheckOutput = {
    /** The id of the renewal. */
    readonly renewalId: string
    /** The CRM code of the service. */
    readonly serviceCode: string
    /** The term paid for, in months. */
    readonly termMonths: number
    /** The domain the registrar renews; null when not renewable by a tool. */
    readonly domain: string | null
    /** The years the registrar renews for; null when not renewable by a tool. */
    readonly years: number | null
    /** The service's provider as the CRM lists it; null when the service is not listed. */
    readonly provider: string | null
    /** Why no registrar tool renews it; null when it is renewable. */
    readonly reason: NotRenewableReason | null
}

const ID = "webrenew.renew-check"

/** The CRM's page of services: its own most. */
const SERVICES_PAGE = 50

/** The most pages of a customer's services the check reads. */
const SERVICES_PAGES_MAX = 4

/** The registrars a domain renewal tool serves (the provider keys the CRM lists a service under). */
const REGISTRARS: ReadonlyArray<string> = [PROVIDER.inet, PROVIDER.tino]

/** A month count of one year. */
const MONTHS_A_YEAR = 12

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<RenewCheckInput> = z.object({
    renewalId: z.uuid(),
    customerCode: z.string().min(1).max(80),
    serviceCode: z.string().min(1).max(120),
    termMonths: z.number().int().min(1).max(120),
    transactionRef: z.string().min(1).max(200),
})

/** The schema of the check's output: what the renewal step takes. */
export const renewCheckOutputSchema: z.ZodType<RenewCheckOutput> = z.object({
    renewalId: z.uuid(),
    serviceCode: z.string().min(1).max(120),
    termMonths: z.number().int().min(1).max(120),
    domain: z.string().min(1).max(253).nullable(),
    years: z.number().int().min(1).max(10).nullable(),
    provider: z.string().min(1).max(40).nullable(),
    reason: z.enum(REASONS).nullable(),
})

/** The registrar's part of the output for a listed service: renewable, or why not. Exact comparisons of the CRM's own values only. */
const renewableOf = (
    service: JsonObject | undefined,
    termMonths: number,
): Pick<RenewCheckOutput, "domain" | "years" | "provider" | "reason"> => {
    if (service === undefined) return { domain: null, years: null, provider: null, reason: "service_not_listed" }
    const provider = textOf(service, "provider")
    const domain = textOf(service, "domain")
    const notRenewable = (reason: NotRenewableReason) => ({ domain: null, years: null, provider, reason })
    if (textOf(service, "serviceClass") !== "domain" || domain === null) return notRenewable("not_a_domain")
    if (provider === null || !REGISTRARS.includes(provider)) return notRenewable("provider_has_no_tool")
    if (termMonths % MONTHS_A_YEAR !== 0) return notRenewable("term_not_whole_years")
    return { domain, years: termMonths / MONTHS_A_YEAR, provider, reason: null }
}

const REQUEST = {
    id: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    customerCode: "KH-001",
    provider: "inet",
    termMonths: 12,
    state: "paid",
    netVnd: 400_000,
    vatVnd: 40_000,
    totalVnd: 440_000,
    priceSource: "price_sheet",
    paymentCode: "GH12345",
    transactionRef: "bank-row-0001",
    paidAt: "2026-11-12T05:00:00.000Z",
    providerRef: null,
    newExpiresOn: null,
    confirmedBy: null,
    confirmedAt: null,
    createdAt: "2026-11-10T02:00:00.000Z",
}

/** One service of the customer as the CRM lists it. */
const serviceOf = (code: string, serviceClass: string, domain: string | null, provider: string | null): JsonObject => ({
    code,
    customerCode: "KH-001",
    domain,
    serviceClass,
    provider,
    status: "active",
    statusText: null,
    startsOn: "2025-12-01",
    expiresOn: "2026-12-12",
    expirySource: "provider",
})

/** The customer's services page holding one service. */
const servicesOf = (...items: ReadonlyArray<JsonObject>): JsonObject => ({ items: [...items], nextCursor: null })

const GIVEN: RenewCheckInput = {
    renewalId: RENEWAL_ID,
    customerCode: "KH-001",
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    transactionRef: "bank-row-0001",
}

const LIST_ARGS = { code: "KH-001", limit: SERVICES_PAGE }

/** The request as the CRM answers it, and the services page of the customer. */
const readsOf = (services: JsonObject) => [
    { id: CRM_NIVOWEB.get_renewals_id, args: { id: RENEWAL_ID }, answer: crmAnswered(REQUEST) },
    { id: CRM_NIVOWEB.get_customers_code_services, args: LIST_ARGS, answer: crmAnswered(services) },
]

const NOT_RENEWABLE = { renewalId: RENEWAL_ID, serviceCode: "EXAMPLE-TM", termMonths: 12, domain: null, years: null }

/**
 * `webrenew.renew-check` (Check the paid renewal, R57): reads only, no AI. It reads the request and checks it EXACTLY against what
 * Accounting handed on (state `paid`, this service, this term, this transaction reference); any difference stops the run with the facts.
 * Then it reads the customer's services and finds the service: a registrar's tool renews it only when it is a `domain` with its domain
 * listed, at `inet` or `tino`, for whole years. Otherwise the output says why (`reason`) and the renewal step makes no call: the team
 * is told a person renews it by hand. A refused read stops the run (the engine reports it; never silent).
 */
export const webrenewRenewCheckNode: TemplateNode<typeof input, typeof renewCheckOutputSchema, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.renewCheck.title"),
    description: {
        vi: "Kiểm tra yêu cầu gia hạn khớp đúng khoản đã thanh toán, và dịch vụ có gia hạn được tại nhà đăng ký tên miền hay không.",
        en: "Checks the renewal request matches the payment exactly, and whether a domain registrar can renew the service.",
    },
    tools: [CRM_NIVOWEB.get_renewals_id, CRM_NIVOWEB.get_customers_code_services],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output: renewCheckOutputSchema,
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
        let cursor: string | null = null
        let service: JsonObject | undefined
        for (let page = 0; page < SERVICES_PAGES_MAX && service === undefined; page += 1) {
            const listed = await context.tools.call(CRM_NIVOWEB.get_customers_code_services, {
                code: given.customerCode,
                limit: SERVICES_PAGE,
                ...(cursor === null ? {} : { cursor }),
            })
            if (!listed.ok)
                return context.fail({ kind: "cannot", why: `services_read_refused:${listed.refusal}` }, listed.facts)
            service = recordsOf(listed.value, "items").find((one) => textOf(one, "code") === given.serviceCode)
            cursor = textOf(listed.value, "nextCursor")
            if (cursor === null) break
        }
        return {
            renewalId: given.renewalId,
            serviceCode: given.serviceCode,
            termMonths: given.termMonths,
            ...renewableOf(service, given.termMonths),
        }
    },
    examples: [
        {
            name: "a paid domain at iNET for a whole year: renewable for 1 year",
            params: {},
            input: GIVEN,
            tools: readsOf(servicesOf(serviceOf("EXAMPLE-TM", "domain", "example.vn", "inet"))),
            output: {
                renewalId: RENEWAL_ID,
                serviceCode: "EXAMPLE-TM",
                termMonths: 12,
                domain: "example.vn",
                years: 1,
                provider: "inet",
                reason: null,
            },
        },
        {
            name: "a hosting service: no registrar tool renews it",
            params: {},
            input: GIVEN,
            tools: readsOf(servicesOf(serviceOf("EXAMPLE-TM", "hosting", "example.vn", "tino"))),
            output: { ...NOT_RENEWABLE, provider: "tino", reason: "not_a_domain" },
        },
        {
            name: "a domain at a provider no tool serves (azwebsite): a person renews it",
            params: {},
            input: GIVEN,
            tools: readsOf(servicesOf(serviceOf("EXAMPLE-TM", "domain", "example.vn", "azwebsite"))),
            output: { ...NOT_RENEWABLE, provider: "azwebsite", reason: "provider_has_no_tool" },
        },
        {
            name: "a term of months that is no whole year: a registrar renews by years",
            params: {},
            input: { ...GIVEN, termMonths: 6 },
            tools: [
                { id: CRM_NIVOWEB.get_renewals_id, args: { id: RENEWAL_ID }, answer: crmAnswered({ ...REQUEST, termMonths: 6 }) },
                {
                    id: CRM_NIVOWEB.get_customers_code_services,
                    args: LIST_ARGS,
                    answer: crmAnswered(servicesOf(serviceOf("EXAMPLE-TM", "domain", "example.vn", "inet"))),
                },
            ],
            output: { ...NOT_RENEWABLE, termMonths: 6, provider: "inet", reason: "term_not_whole_years" },
        },
        {
            name: "a service the customer's list does not hold: not listed",
            params: {},
            input: GIVEN,
            tools: readsOf(servicesOf(serviceOf("OTHER-TM", "domain", "other.vn", "inet"))),
            output: { ...NOT_RENEWABLE, provider: null, reason: "service_not_listed" },
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
            name: "a refused read of the request stops the run",
            params: {},
            input: GIVEN,
            tools: [{ id: CRM_NIVOWEB.get_renewals_id, args: { id: RENEWAL_ID }, answer: crmRefused("not_found") }],
            failure: { kind: "cannot", why: "renewal_read_refused:not_found" },
        },
        {
            name: "a refused read of the services stops the run",
            params: {},
            input: GIVEN,
            tools: [
                { id: CRM_NIVOWEB.get_renewals_id, args: { id: RENEWAL_ID }, answer: crmAnswered(REQUEST) },
                { id: CRM_NIVOWEB.get_customers_code_services, args: LIST_ARGS, answer: crmRefused("not_found") },
            ],
            failure: { kind: "cannot", why: "services_read_refused:not_found" },
        },
    ],
})
