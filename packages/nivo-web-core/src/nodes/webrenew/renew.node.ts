import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewText } from "../../modules/webrenew/copy"
import { WEBRENEW_REGISTRARS } from "../../modules/webrenew/webrenew.accounts"
import { type RenewCheckOutput, renewCheckOutputSchema } from "./renew-check.node"
import { ID_MAX } from "./renew-shapes"
import { isDeclined, textOf } from "./webrenew.calls"
import { RENEWAL_ID, refused, registrarAnswered } from "./webrenew.examples"

/**
 * Where a renewal stands after the registrar step: `renewed` (the registrar's end date moved, `newExpiresOn` given), `pending` (the
 * registrar took the order, the end date did not move yet: a person checks it later), `refused` (the registrar refused, nothing renewed:
 * the customer has paid, a person tops up or renews by hand), `not_renewable` (no registrar tool renews this service: a person renews it).
 */
export type RenewOutcome = "renewed" | "pending" | "refused" | "not_renewable"

const OUTCOMES: readonly [RenewOutcome, ...Array<RenewOutcome>] = ["renewed", "pending", "refused", "not_renewable"]

/** What the step did, when a person did not decline it: the renewal and the registrar's answer. */
export type RenewOutput = {
    /** The id of the renewal. */
    readonly renewalId: string
    /** The CRM code of the service. */
    readonly serviceCode: string
    /** The term paid for, in months. */
    readonly termMonths: number
    /** Where the renewal stands. */
    readonly outcome: RenewOutcome
    /** Why it was not renewed: the registrar's refusal, or the check's reason; null when renewed or pending. */
    readonly reason: string | null
    /** The registrar's order reference; null when no order was taken. */
    readonly reference: string | null
    /** The registrar that answered; null when none was called. */
    readonly provider: string | null
    /** The service's new end date (ISO date), only when renewed. */
    readonly newExpiresOn: string | null
    /** The end date the registrar read before the renewal; null when it gave none. */
    readonly expiresBefore: string | null
}

/**
 * What the step left: the renewal (`declined` false), or a person's decline of the registrar call (`declined` true: nothing renewed,
 * `outcome` and the registrar's members null). The graph routes `declined` to the team's notice and the outcome `declined`.
 */
export type RenewStepOutput = Omit<RenewOutput, "outcome"> & {
    /** True when a person declined the renewal. */
    readonly declined: boolean
    /** Where the renewal stands; null when it was declined. */
    readonly outcome: RenewOutcome | null
}

const ID = "webrenew.renew"

const params: z.ZodType<Record<string, never>> = z.object({})

const members = {
    renewalId: z.uuid(),
    serviceCode: z.string().min(1).max(120),
    termMonths: z.number().int().min(1).max(120),
    reason: z.string().min(1).max(ID_MAX).nullable(),
    reference: z.string().min(1).max(200).nullable(),
    provider: z.string().min(1).max(40).nullable(),
    newExpiresOn: z.string().max(10).nullable(),
    expiresBefore: z.string().max(10).nullable(),
}

/** The schema of the renewal as the step left it (not declined): what the team and the customer steps read. */
export const renewOutputSchema: z.ZodType<RenewOutput> = z.object({ ...members, outcome: z.enum(OUTCOMES) })
const output: z.ZodType<RenewStepOutput> = z.object({
    ...members,
    declined: z.boolean(),
    outcome: z.enum(OUTCOMES).nullable(),
})

/** The registrar's two outcomes of a renewal it took. */
const takenOf = (value: unknown): "renewed" | "pending" | null =>
    value === "renewed" || value === "pending" ? value : null

const CHECKED: RenewCheckOutput = {
    renewalId: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    domain: "example.vn",
    years: 1,
    provider: "inet",
    reason: null,
}

const CALL = { name: "example.vn", years: 1 }

/** The registrar's answer of a renewal it took. */
const takenAnswer = (outcome: "renewed" | "pending", expiresOn: string | null) =>
    registrarAnswered(PROVIDER.inet, {
        provider: "inet",
        name: "example.vn",
        reference: "INET-ORD-7781",
        total: 350_000,
        providerData: {},
        outcome,
        expiresBefore: "2026-12-12",
        expiresOn,
    })

const UNTOUCHED = { renewalId: RENEWAL_ID, serviceCode: "EXAMPLE-TM", termMonths: 12 }

/**
 * `webrenew.renew` (Renew at the provider, R57): ONE registrar call, no AI. It takes the check's output: when no registrar tool renews
 * the service (`reason` given) it makes NO call and returns `not_renewable` with the reason. Else it renews the domain for the years paid
 * (`nivo.tool.domain.renewal.create` `{ name, years }`) on the registrar account (iNET, else Tino), mode `ask`: the money leaves NIVO Web's
 * balance at the registrar, so a person approves the call. The registrar's answer is the output: `renewed` with the new end date, or
 * `pending` (order taken, end date unchanged: checked later); a business refusal is `refused` with its code (nothing renewed, a person
 * acts). An answer with no known outcome stops the run. A person who declines the call made a decision: `declined` true, nothing
 * renewed (the graph tells the team and ends `declined`).
 */
export const webrenewRenewNode: TemplateNode<typeof renewCheckOutputSchema, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.renew.title"),
    description: {
        vi: "Gia hạn tên miền tại nhà đăng ký sau khi khách đã trả tiền; tốn tiền của công ty nên cần người duyệt.",
        en: "Renews the domain at the registrar once the customer has paid; it spends the company's balance, so a person approves it.",
    },
    tools: [TOOL.domainRenewalCreate],
    mode: "ask",
    accounts: [...WEBRENEW_REGISTRARS],
    params,
    input: renewCheckOutputSchema,
    output,
    run: async (given, context) => {
        const untouched = { renewalId: given.renewalId, serviceCode: given.serviceCode, termMonths: given.termMonths }
        const nothing = { reference: null, provider: null, newExpiresOn: null, expiresBefore: null }
        if (given.reason !== null)
            return { ...untouched, ...nothing, declined: false, outcome: "not_renewable", reason: given.reason }
        if (given.domain === null || given.years === null)
            return context.fail({ kind: "cannot", why: "renewal_check_incomplete" }, { serviceCode: given.serviceCode })
        const renewed = await context.tools.call(TOOL.domainRenewalCreate, { name: given.domain, years: given.years })
        if (isDeclined(renewed)) return { ...untouched, ...nothing, declined: true, outcome: null, reason: null }
        if (!renewed.ok) return { ...untouched, ...nothing, declined: false, outcome: "refused", reason: renewed.refusal }
        const outcome = takenOf(renewed.value["outcome"])
        const expiresOn = textOf(renewed.value, "expiresOn")
        if (outcome === null || (outcome === "renewed" && expiresOn === null))
            return context.fail({ kind: "cannot", why: "renewal_answered_incomplete" }, renewed.value)
        return {
            ...untouched,
            declined: false,
            outcome,
            reason: null,
            reference: textOf(renewed.value, "reference"),
            provider: textOf(renewed.value, "provider"),
            newExpiresOn: outcome === "renewed" ? expiresOn : null,
            expiresBefore: textOf(renewed.value, "expiresBefore"),
        }
    },
    examples: [
        {
            name: "renews the domain at the registrar: the new end date as the registrar read it",
            params: {},
            input: CHECKED,
            tools: [{ id: TOOL.domainRenewalCreate, args: CALL, answer: takenAnswer("renewed", "2027-12-12") }],
            output: {
                ...UNTOUCHED,
                declined: false,
                outcome: "renewed",
                reason: null,
                reference: "INET-ORD-7781",
                provider: "inet",
                newExpiresOn: "2027-12-12",
                expiresBefore: "2026-12-12",
            },
        },
        {
            name: "the registrar took the order but the end date did not move yet: pending, no new date",
            params: {},
            input: CHECKED,
            tools: [{ id: TOOL.domainRenewalCreate, args: CALL, answer: takenAnswer("pending", "2026-12-12") }],
            output: {
                ...UNTOUCHED,
                declined: false,
                outcome: "pending",
                reason: null,
                reference: "INET-ORD-7781",
                provider: "inet",
                newExpiresOn: null,
                expiresBefore: "2026-12-12",
            },
        },
        {
            name: "the registrar refuses (the balance is short): refused with its code, nothing renewed",
            params: {},
            input: CHECKED,
            tools: [{ id: TOOL.domainRenewalCreate, args: CALL, answer: refused("insufficient_balance") }],
            output: {
                ...UNTOUCHED,
                declined: false,
                outcome: "refused",
                reason: "insufficient_balance",
                reference: null,
                provider: null,
                newExpiresOn: null,
                expiresBefore: null,
            },
        },
        {
            name: "a service no registrar tool renews: no call, not renewable with the check's reason",
            params: {},
            input: { ...CHECKED, domain: null, years: null, provider: "azwebsite", reason: "provider_has_no_tool" },
            output: {
                ...UNTOUCHED,
                declined: false,
                outcome: "not_renewable",
                reason: "provider_has_no_tool",
                reference: null,
                provider: null,
                newExpiresOn: null,
                expiresBefore: null,
            },
        },
        {
            name: "a person declines the renewal: nothing is renewed, the step returns `declined` (their decision)",
            params: {},
            input: CHECKED,
            tools: [{ id: TOOL.domainRenewalCreate, args: CALL, answer: refused("declined") }],
            output: {
                ...UNTOUCHED,
                declined: true,
                outcome: null,
                reason: null,
                reference: null,
                provider: null,
                newExpiresOn: null,
                expiresBefore: null,
            },
        },
        {
            name: "an answer that names no known outcome stops the run",
            params: {},
            input: CHECKED,
            tools: [
                {
                    id: TOOL.domainRenewalCreate,
                    args: CALL,
                    answer: registrarAnswered(PROVIDER.inet, { provider: "inet", name: "example.vn", reference: "INET-ORD-7781" }),
                },
            ],
            failure: { kind: "cannot", why: "renewal_answered_incomplete" },
        },
    ],
})
