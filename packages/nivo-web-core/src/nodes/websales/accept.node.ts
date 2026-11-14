import { refused } from "../web-answers"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { websalesText } from "../../modules/websales/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import type { ClosingCustomer } from "./customer-propose.node"
import { ID_MAX, type PurchaseRef, purchaseRefShape, purchaseSchema } from "./sales-shapes"
import { DECLINED, parsedOrCannot, readPurchase, valueOrCannot } from "./websales-calls"
import { PURCHASE, PURCHASE_ID, QUOTE, crmAnswered, purchaseOf } from "./websales.fixtures"

/**
 * The purchase and its customer, as the step that settled the customer hands them on. `customerCode` is nullable as that step's output
 * holds it (null when a person declined opening the customer); the close reaches this step only when it was settled (its `ifNode`
 * on `declined`), so a null here is a contract fault the node stops on.
 */
export type AcceptInput = PurchaseRef & {
    /** The CRM code of the customer who accepted; null when unknown. */
    readonly customerCode: string | null
}

/** What the CRM opened when it accepted the purchase, every member copied from its answer. */
export type AcceptedPurchase = ClosingCustomer & {
    /** The purchase's `state` after the acceptance. */
    readonly state: string
    /** True when the CRM only rehearsed the records (an account that is not live). */
    readonly dryRun: boolean
    /** The contract record the CRM opened. */
    readonly contractNo: string
    /** The project the CRM opened, when the purchase builds something. */
    readonly projectCode: string | null
    /** The services the CRM opened. */
    readonly serviceCodes: ReadonlyArray<string>
    /** The code the customer writes on the transfer. */
    readonly paymentCode: string
    /** The first instalment, as the CRM computed it. */
    readonly firstInstalmentVnd: number
}

/**
 * What the step answers: the accepted purchase (`declined: false`), or, when a person declined the acceptance, the purchase and its
 * customer with every member the CRM would have opened null (`declined: true`: a decision, nothing is recorded; the graph posts the
 * team's notice and ends `declined`, so no later step reads those nulls). A union, so each later step's input stays the accepted
 * purchase.
 */
export type AcceptOutput =
    | (AcceptedPurchase & { readonly declined: false })
    | (ClosingCustomer & {
          readonly declined: true
          readonly state: null
          readonly dryRun: null
          readonly contractNo: null
          readonly projectCode: null
          readonly serviceCodes: null
          readonly paymentCode: null
          readonly firstInstalmentVnd: null
      })

const ID = "websales.accept"

const code = z.string().min(1).max(ID_MAX)

const input: z.ZodType<AcceptInput> = z.object({ ...purchaseRefShape, customerCode: code.nullable() })

/** The zod members of an accepted purchase. */
export type AcceptedPurchaseShape = {
    /** The schema of the `purchaseId` member. */
    readonly purchaseId: z.ZodString
    /** The schema of the `purchaseCode` member. */
    readonly purchaseCode: z.ZodString
    /** The schema of the `customerCode` member. */
    readonly customerCode: z.ZodString
    /** The schema of the `state` member. */
    readonly state: z.ZodString
    /** The schema of the `dryRun` member. */
    readonly dryRun: z.ZodBoolean
    /** The schema of the `contractNo` member. */
    readonly contractNo: z.ZodString
    /** The schema of the `projectCode` member. */
    readonly projectCode: z.ZodNullable<z.ZodString>
    /** The schema of the `serviceCodes` member. */
    readonly serviceCodes: z.ZodArray<z.ZodString>
    /** The schema of the `paymentCode` member. */
    readonly paymentCode: z.ZodString
    /** The schema of the `firstInstalmentVnd` member. */
    readonly firstInstalmentVnd: z.ZodNumber
}

/** The members of an accepted purchase. */
export const acceptedPurchaseShape: AcceptedPurchaseShape = {
    ...purchaseRefShape,
    customerCode: code,
    state: z.string().min(1).max(40),
    dryRun: z.boolean(),
    contractNo: code,
    projectCode: code.nullable(),
    serviceCodes: z.array(code).max(50),
    paymentCode: z.string().min(1).max(20),
    firstInstalmentVnd: z.number().int().positive(),
}

const output: z.ZodType<AcceptOutput> = z.discriminatedUnion("declined", [
    z.object({ ...acceptedPurchaseShape, declined: z.literal(false) }),
    z.object({
        ...purchaseRefShape,
        customerCode: code,
        declined: z.literal(true),
        state: z.null(),
        dryRun: z.null(),
        contractNo: z.null(),
        projectCode: z.null(),
        serviceCodes: z.null(),
        paymentCode: z.null(),
        firstInstalmentVnd: z.null(),
    }),
])

/** The acceptance as the CRM answers it (`AcceptanceResponse`). */
const acceptanceSchema = z.looseObject({
    purchase: purchaseSchema,
    dryRun: z.boolean(),
    contractNo: code,
    projectCode: code.nullable(),
    serviceCodes: z.array(code).max(50),
    paymentCode: z.string().min(1).max(20),
    firstInstalmentVnd: z.number().int().positive(),
})

/**
 * `websales.accept` (Lap ho so mua): the third step of "Chot don moi". A plain call now (no AI; version 1 ran an agent to copy an
 * answer): the node reads the purchase and checks, EXACTLY, that it holds a quote and that the quote still holds on the run's day
 * (`ctx.run.day`, the workspace's calendar day); then it records the acceptance for the settled customer (`purchase.accept.record`: the CRM opens the
 * project, the services, the contract record and the receivable). Every member of its output is copied from the CRM's answer. A
 * missing or lapsed quote, or a refusal, stops the step. A person who declines the write made a decision: the step returns
 * `declined: true` (never a failure), and the close goes no further without the acceptance (the graph's notice, outcome `declined`).
 */
export const websalesAcceptNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: websalesText("node.accept.title"),
    description: { vi: "L\u1eadp h\u1ed3 s\u01a1 mua cho kh\u00e1ch \u0111\u00e3 \u0111\u1ed3ng \u00fd b\u00e1o gi\u00e1 c\u00f2n hi\u1ec7u l\u1ef1c: m\u1edf d\u1ef1 \u00e1n, d\u1ecbch v\u1ee5, h\u1ee3p \u0111\u1ed3ng v\u00e0 kho\u1ea3n ph\u1ea3i thu.", en: "Records the purchase for a customer who accepted a quote that is still valid: opens the project, services, contract and receivable." },
    tools: [CRM_NIVOWEB.get_purchases_id, CRM_NIVOWEB.post_purchases_id_acceptance],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    run: async (given, context) => {
        const customerCode = given.customerCode
        if (customerCode === null)
            return context.fail({ kind: "cannot", why: "the customer step answered no customer to accept for" })
        const purchase = await readPurchase(context, given.purchaseId)
        if (purchase.quote === null)
            return context.fail({ kind: "cannot", why: `purchase ${purchase.code} holds no quote` })
        if (purchase.quote.validUntil < context.run.day) {
            return context.fail({
                kind: "cannot",
                why: `the quote of ${purchase.code} held until ${purchase.quote.validUntil}`,
            })
        }
        const answer = await context.tools.call(CRM_NIVOWEB.post_purchases_id_acceptance, { id: given.purchaseId, customerCode })
        if (!answer.ok && answer.declined === true) {
            return {
                purchaseId: given.purchaseId,
                purchaseCode: given.purchaseCode,
                customerCode,
                declined: true,
                state: null,
                dryRun: null,
                contractNo: null,
                projectCode: null,
                serviceCodes: null,
                paymentCode: null,
                firstInstalmentVnd: null,
            }
        }
        const accepted = parsedOrCannot(
            context,
            CRM_NIVOWEB.post_purchases_id_acceptance,
            acceptanceSchema,
            valueOrCannot(context, CRM_NIVOWEB.post_purchases_id_acceptance, answer),
        )
        return {
            purchaseId: given.purchaseId,
            purchaseCode: given.purchaseCode,
            customerCode,
            state: accepted.purchase.state,
            dryRun: accepted.dryRun,
            contractNo: accepted.contractNo,
            projectCode: accepted.projectCode,
            serviceCodes: accepted.serviceCodes,
            paymentCode: accepted.paymentCode,
            firstInstalmentVnd: accepted.firstInstalmentVnd,
            declined: false,
        }
    },
    examples: [
        {
            name: "no customer handed on is a contract fault: the step stops before any read or write",
            params: {},
            input: { ...PURCHASE, customerCode: null },
            failure: { kind: "cannot", why: "the customer step answered no customer to accept for" },
        },
        {
            name: "records the acceptance and copies the contract, the payment code and the first instalment from the answer",
            params: {},
            input: { ...PURCHASE, customerCode: "KH-0042" },
            tools: [
                {
                    id: CRM_NIVOWEB.get_purchases_id,
                    args: { id: PURCHASE_ID },
                    answer: crmAnswered(purchaseOf({ state: "quoted", quote: QUOTE })),
                },
                {
                    id: CRM_NIVOWEB.post_purchases_id_acceptance,
                    args: { id: PURCHASE_ID, customerCode: "KH-0042" },
                    answer: crmAnswered({
                        purchase: purchaseOf({
                            state: "awaiting_payment",
                            customerCode: "KH-0042",
                            paymentCode: "NW7C1D2E3F",
                            acceptedAt: "2026-11-12",
                            projectCode: "DA-0031",
                            contractNo: "HD-2026-0131",
                            quote: QUOTE,
                        }),
                        contractNo: "HD-2026-0131",
                        projectCode: "DA-0031",
                        serviceCodes: ["DV-0201"],
                        paymentCode: "NW7C1D2E3F",
                        firstInstalmentVnd: 6_600_000,
                        dryRun: true,
                    }),
                },
            ],
            output: {
                ...PURCHASE,
                customerCode: "KH-0042",
                state: "awaiting_payment",
                dryRun: true,
                contractNo: "HD-2026-0131",
                projectCode: "DA-0031",
                serviceCodes: ["DV-0201"],
                paymentCode: "NW7C1D2E3F",
                firstInstalmentVnd: 6_600_000,
                declined: false,
            },
        },
        {
            name: "a purchase with no quote is not accepted: the step stops before the write",
            params: {},
            input: { ...PURCHASE, customerCode: "KH-0042" },
            tools: [{ id: CRM_NIVOWEB.get_purchases_id, args: { id: PURCHASE_ID }, answer: crmAnswered(purchaseOf({})) }],
            failure: { kind: "cannot", why: "purchase MUA-7C1D2E3F holds no quote" },
        },
        {
            name: "a quote that no longer holds on the run's day is not accepted",
            params: {},
            input: { ...PURCHASE, customerCode: "KH-0042" },
            at: "2026-11-23T18:00:00.000Z",
            day: "2026-11-24",
            tools: [
                {
                    id: CRM_NIVOWEB.get_purchases_id,
                    args: { id: PURCHASE_ID },
                    answer: crmAnswered(purchaseOf({ state: "quoted", quote: QUOTE })),
                },
            ],
            failure: { kind: "cannot", why: "the quote of MUA-7C1D2E3F held until 2026-11-23" },
        },
        {
            name: "the CRM's refusal of the acceptance stops the step",
            params: {},
            input: { ...PURCHASE, customerCode: "KH-0042" },
            tools: [
                {
                    id: CRM_NIVOWEB.get_purchases_id,
                    args: { id: PURCHASE_ID },
                    answer: crmAnswered(purchaseOf({ state: "quoted", quote: QUOTE })),
                },
                {
                    id: CRM_NIVOWEB.post_purchases_id_acceptance,
                    args: { id: PURCHASE_ID, customerCode: "KH-0042" },
                    answer: refused("state_not_quoted", { state: "lost" }),
                },
            ],
            failure: { kind: "cannot", why: `${CRM_NIVOWEB.post_purchases_id_acceptance} refused: state_not_quoted` },
        },
        {
            name: "a person who declines the acceptance is a decision: nothing is recorded and the step returns declined",
            params: {},
            input: { ...PURCHASE, customerCode: "KH-0042" },
            tools: [
                {
                    id: CRM_NIVOWEB.get_purchases_id,
                    args: { id: PURCHASE_ID },
                    answer: crmAnswered(purchaseOf({ state: "quoted", quote: QUOTE })),
                },
                {
                    id: CRM_NIVOWEB.post_purchases_id_acceptance,
                    args: { id: PURCHASE_ID, customerCode: "KH-0042" },
                    answer: refused(DECLINED),
                },
            ],
            output: {
                ...PURCHASE,
                customerCode: "KH-0042",
                declined: true,
                state: null,
                dryRun: null,
                contractNo: null,
                projectCode: null,
                serviceCodes: null,
                paymentCode: null,
                firstInstalmentVnd: null,
            },
        },
    ],
})
