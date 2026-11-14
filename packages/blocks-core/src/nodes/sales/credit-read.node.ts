import { PROVIDER, TOOL, type ProviderKey } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot, viaAccount } from "../tool-answers"

/** The credit the bank trigger named. */
export interface CreditReadInput {
    /** The raw bank row the trigger named (`trigger.transactionId`). */
    readonly transactionId: string
}

/** The bank providers whose feed a credit comes from, in the order the agent picks an attached account. */
export const BANK_FEED_PROVIDERS: ReadonlyArray<ProviderKey> = [PROVIDER.sepay, PROVIDER.casso, PROVIDER.payos]

/** The money movement exactly as the bank reported it: what the steps after it compare. */
export interface CreditReadOutput {
    /** The raw bank row. */
    readonly transactionId: string
    /** `in` for money that came in, `out` for money that went out. */
    readonly direction: "in" | "out"
    /** The amount, VND. */
    readonly amountVnd: number
    /** The transfer content the payer wrote, as the bank reported it. */
    readonly content: string
    /** When it happened. */
    readonly occurredAt: string
}

const input: NodeSchema<CreditReadInput> = z.object({ transactionId: z.string().min(1).max(MAX_ID) })

const output: NodeSchema<CreditReadOutput> = z.object({
    transactionId: z.string().min(1).max(MAX_ID).describe("The raw bank row."),
    direction: z.enum(["in", "out"]).describe("`in` for money that came in, `out` for money that went out."),
    amountVnd: z.number().int().describe("The amount, VND."),
    content: z.string().max(MAX_LINE).describe("The transfer content, as the bank reported it."),
    occurredAt: z.string().min(1).max(40).describe("When it happened."),
})

/** One movement as `nivo.tool.payment.credit.get` answers it, the same shape for every bank provider. */
const creditShape = z.object({
    id: z.string().min(1).max(MAX_ID),
    direction: z.enum(["in", "out"]),
    amountVnd: z.number().int(),
    content: z.string().max(MAX_LINE),
    at: z.string().min(1).max(40),
})

/** The credit of the examples, as the SePay account reported it. */
const CREDIT = {
    id: "tx-1",
    direction: "in",
    amountVnd: 4500,
    content: "CK DH-20261113-0001 Lan",
    at: "2026-11-13T09:00:00.000Z",
    bankRef: "FT2611130001",
}

/**
 * `sales.credit-read` (Doc khoan tien ve): reads the ONE movement the bank trigger named, exactly as the bank reported it
 * (`nivo.tool.payment.credit.get` with `transactionId`, on the agent's SePay, Casso or payOS account: one shape for the three), and hands
 * its direction, amount and transfer content to the steps after it, which compare them exactly. Plain logic: it decides nothing. A row the
 * tool does not answer (not one of the account's) stops the run for the engine's report.
 */
export const salesCreditReadNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.credit-read",
    title: bilingualOf("nodeSalesCreditReadTitle"),
    description: { vi: "\u0110\u1ecdc m\u1ed9t kho\u1ea3n ti\u1ec1n v\u1eeba v\u1ec1 theo \u0111\u00fang nh\u01b0 ng\u00e2n h\u00e0ng b\u00e1o: chi\u1ec1u ti\u1ec1n, s\u1ed1 ti\u1ec1n v\u00e0 n\u1ed9i dung chuy\u1ec3n kho\u1ea3n.", en: "Reads one incoming payment exactly as the bank reported it: direction, amount and transfer content." },
    tools: [TOOL.paymentCreditGet],
    mode: "auto",
    accounts: [...BANK_FEED_PROVIDERS],
    input,
    output,
    run: async (given, context) => {
        const read = creditShape.safeParse(
            valueOrCannot(
                context,
                TOOL.paymentCreditGet,
                await context.tools.call(TOOL.paymentCreditGet, { transactionId: given.transactionId }),
            ),
        )
        if (!read.success) return context.fail({ kind: "cannot", why: `${TOOL.paymentCreditGet} answered an unknown shape` })
        const credit = read.data
        return {
            transactionId: credit.id,
            direction: credit.direction,
            amountVnd: credit.amountVnd,
            content: credit.content,
            occurredAt: credit.at,
        }
    },
    examples: [
        {
            name: "the credit the trigger named is read exactly as the bank reported it: direction, amount and transfer content",
            params: {},
            input: { transactionId: "tx-1" },
            tools: [
                {
                    id: TOOL.paymentCreditGet,
                    args: { transactionId: "tx-1" },
                    answer: answered(CREDIT, viaAccount(PROVIDER.sepay)),
                },
            ],
            output: { transactionId: "tx-1", direction: "in", amountVnd: 4500, content: CREDIT.content, occurredAt: CREDIT.at },
        },
        {
            name: "a Casso credit reads the same: one shape for every bank provider",
            params: {},
            input: { transactionId: "tx-2" },
            tools: [
                {
                    id: TOOL.paymentCreditGet,
                    args: { transactionId: "tx-2" },
                    answer: answered({ ...CREDIT, id: "tx-2" }, viaAccount(PROVIDER.casso)),
                },
            ],
            output: { transactionId: "tx-2", direction: "in", amountVnd: 4500, content: CREDIT.content, occurredAt: CREDIT.at },
        },
        {
            name: "a row the tool does not answer as one of the account's stops the run with the refusal",
            params: {},
            input: { transactionId: "tx-9" },
            tools: [{ id: TOOL.paymentCreditGet, args: { transactionId: "tx-9" }, answer: refused("not_found") }],
            failure: { kind: "cannot", why: `${TOOL.paymentCreditGet} refused: not_found` },
        },
    ],
})
