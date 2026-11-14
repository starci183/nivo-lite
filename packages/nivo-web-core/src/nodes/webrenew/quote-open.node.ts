import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { optionalTerm } from "./answer-shapes"
import { type TeamLocale, localeSchema } from "./renew-shapes"
import { isDeclined, numberOf, textOf } from "./webrenew.calls"
import { RENEWAL_ID, crmAnswered, crmRefused, truthsAnswer } from "./webrenew.examples"
import { webrenewText } from "../../modules/webrenew/copy"

/** One service the customer agreed to renew, the term they said (null when they said none), and the team's language. */
type QuoteOpenInput = {
    readonly serviceCode: string
    readonly termMonths: number | null
    readonly locale: TeamLocale
}

/** The renewal request the CRM opened, as it answered it: what the customer is told, exactly. */
export type OpenedQuote = {
    /** The request's id. */
    readonly renewalId: string
    /** The service. */
    readonly serviceCode: string
    /** The term, in months. */
    readonly termMonths: number
    /** The total the CRM computed, VAT included. */
    readonly totalVnd: number
    /** The payment code the transfer must carry. */
    readonly paymentCode: string
}

/**
 * What the step left for one service: the request the CRM opened, or a person's decline of the request (`declined` true: nothing
 * opened, the request's members null). The answer graph's loop collects it.
 */
export type QuoteOpenOutput = {
    /** True when a person declined the request (a shop's own `ask`): nothing was opened. */
    readonly declined: boolean
    /** The request's id; null when declined. */
    readonly renewalId: string | null
    /** The service. */
    readonly serviceCode: string
    /** The term, in months (the one asked for when declined). */
    readonly termMonths: number
    /** The total the CRM computed, VAT included; null when declined. */
    readonly totalVnd: number | null
    /** The payment code the transfer must carry; null when declined. */
    readonly paymentCode: string | null
}

/** The request one step opened, or null when a person declined it. */
export const openedOf = (opened: QuoteOpenOutput): OpenedQuote | null =>
    opened.declined || opened.renewalId === null || opened.totalVnd === null || opened.paymentCode === null
        ? null
        : {
              renewalId: opened.renewalId,
              serviceCode: opened.serviceCode,
              termMonths: opened.termMonths,
              totalVnd: opened.totalVnd,
              paymentCode: opened.paymentCode,
          }

const ID = "webrenew.quote-open"

/** What the agent may read when the customer said no term: the service, its status, and the truths (the usual term per class). */
const TERM_READS = [CRM_NIVOWEB.get_services_code_status]

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<QuoteOpenInput> = z.object({
    serviceCode: z.string().min(1).max(120),
    termMonths: optionalTerm,
    locale: localeSchema,
})

/** The schema of what the step left for one service (the loop's collected output). */
export const quoteOpenOutputSchema: z.ZodType<QuoteOpenOutput> = z.object({
    declined: z.boolean(),
    renewalId: z.uuid().nullable(),
    serviceCode: z.string().min(1).max(120),
    termMonths: z.number().int().min(1).max(120),
    totalVnd: z.number().int().nonnegative().nullable(),
    paymentCode: z.string().min(1).max(60).nullable(),
})
const output: z.ZodType<QuoteOpenOutput> = quoteOpenOutputSchema

/** What the agent answers when the customer said no term: the usual term the truths name for this service's class. */
const termDecision = z.object({
    termMonths: z
        .number()
        .int()
        .min(1)
        .max(120)
        .describe("The usual renewal term for this service's class, as a truth names it."),
})

const TERM_GOAL =
    "The customer agreed to renew this service but said no term. Read the service's status and search the company's truths for the " +
    "usual renewal term of its class. Answer that term. When no truth names it, do not guess: say you are confused."

const REQUEST = {
    id: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    customerCode: "KH-001",
    provider: "manual",
    termMonths: 12,
    state: "awaiting_payment",
    netVnd: 400_000,
    vatVnd: 40_000,
    totalVnd: 440_000,
    priceSource: "price_sheet",
    paymentCode: "GH12345",
    transactionRef: null,
    paidAt: null,
    dryRun: true,
    plugin: "manual",
    providerRef: null,
    newExpiresOn: null,
}

const STATUS = {
    serviceCode: "EXAMPLE-TM",
    plugin: "manual",
    state: "active",
    expiresOn: "2026-12-12",
    checkedBy: "person",
    note: "a person checks",
}

const OPENED: QuoteOpenOutput = {
    declined: false,
    renewalId: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    totalVnd: 440_000,
    paymentCode: "GH12345",
}

/**
 * `webrenew.quote-open` (Open the renewal request): ONE renewal request for ONE service the customer agreed to renew, in the CRM
 * (`nivo.api.crm.nivoweb.post.renewals`): the CRM computes the total and the payment code. Run once per service by the answer
 * graph's loop (a customer may agree for several services; each request is its own write, re-run alone). When the customer said
 * no term, the agent reads the usual term of the service's class from the truths first, and is confused when no truth names it. A
 * refused request stops the run: the customer is never told a quote the CRM did not open. A person who declines the request made
 * a decision: the step RETURNS `declined` true (nothing opened); the loop's body tells the team and ends that item, the other
 * services go on, and the quote names only the requests opened.
 */
export const webrenewQuoteOpenNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.quoteOpen.title"),
    description: { vi: "M\u1edf m\u1ed9t y\u00eau c\u1ea7u gia h\u1ea1n cho m\u1ed9t d\u1ecbch v\u1ee5 kh\u00e1ch \u0111\u1ed3ng \u00fd gia h\u1ea1n; h\u1ec7 th\u1ed1ng kh\u00e1ch h\u00e0ng t\u00ednh t\u1ed5ng ti\u1ec1n v\u00e0 m\u00e3 thanh to\u00e1n.", en: "Opens one renewal request for a service the customer agreed to renew; the customer system works out the total and the payment code." },
    tools: [...TERM_READS, CRM_NIVOWEB.post_renewals],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const termMonths =
            given.termMonths ??
            (
                await context.agent.run({
                    goal: TERM_GOAL,
                    input: { serviceCode: given.serviceCode, locale: given.locale },
                    output: termDecision,
                    tools: TERM_READS,
                    maxTurns: 4,
                })
            ).termMonths
        const opened = await context.tools.call(CRM_NIVOWEB.post_renewals, { serviceCode: given.serviceCode, termMonths })
        if (isDeclined(opened)) {
            return {
                declined: true,
                renewalId: null,
                serviceCode: given.serviceCode,
                termMonths,
                totalVnd: null,
                paymentCode: null,
            }
        }
        if (!opened.ok)
            return context.fail({ kind: "cannot", why: `renewal_quote_refused:${opened.refusal}` }, opened.facts)
        const renewalId = textOf(opened.value, "id")
        const totalVnd = numberOf(opened.value, "totalVnd")
        const paymentCode = textOf(opened.value, "paymentCode")
        if (renewalId === null || totalVnd === null || paymentCode === null) {
            return context.fail({ kind: "cannot", why: "renewal_quote_answered_incomplete" }, opened.value)
        }
        return {
            declined: false,
            renewalId,
            serviceCode: given.serviceCode,
            termMonths: numberOf(opened.value, "termMonths") ?? termMonths,
            totalVnd,
            paymentCode,
        }
    },
    examples: [
        {
            name: "opens the request for the term the customer said, as the CRM computes it",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", termMonths: 12, locale: "vi" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals,
                    args: { serviceCode: "EXAMPLE-TM", termMonths: 12 },
                    answer: crmAnswered(REQUEST),
                },
            ],
            output: OPENED,
        },
        {
            name: "a customer who said no term gets the usual term of the class the truths name",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", termMonths: null, locale: "vi" },
            agent: [
                {
                    answer: { termMonths: 12 },
                    // the agent's own reads, in call order
                    calls: [
                        { id: CRM_NIVOWEB.get_services_code_status, args: { code: "EXAMPLE-TM" }, answer: crmAnswered(STATUS) },
                        {
                            id: TOOL.brainSearch,
                            args: { query: "thoi han gia han ten mien" },
                            answer: truthsAnswer([{ id: "f-term-1", text: "Ten mien gia han theo nam (12 thang)." }]),
                        },
                    ],
                },
            ],
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals,
                    args: { serviceCode: "EXAMPLE-TM", termMonths: 12 },
                    answer: crmAnswered(REQUEST),
                },
            ],
            output: OPENED,
        },
        {
            name: "a refused request stops the run",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", termMonths: 12, locale: "vi" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals,
                    args: { serviceCode: "EXAMPLE-TM", termMonths: 12 },
                    answer: crmRefused("renewal_already_open"),
                },
            ],
            failure: { kind: "cannot", why: "renewal_quote_refused:renewal_already_open" },
        },
        {
            name: "a person declines the request: nothing is opened, the step returns `declined`",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", termMonths: 12, locale: "vi" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_renewals,
                    args: { serviceCode: "EXAMPLE-TM", termMonths: 12 },
                    answer: crmRefused("declined"),
                },
            ],
            output: {
                declined: true,
                renewalId: null,
                serviceCode: "EXAMPLE-TM",
                termMonths: 12,
                totalVnd: null,
                paymentCode: null,
            },
        },
    ],
})
