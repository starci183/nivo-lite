import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { creditsOk } from "./books.fixtures"
import { idSchema } from "./books-shapes"

/** The most rows one read lists (the credit list's own most). */
const LIST_MAX = 50

/** What woke the graph: the id of the raw bank row the credit trigger names. */
const input = z.object({ transactionId: idSchema })

/**
 * One credit as the bank account's credit list answers it (`TOOL.paymentCreditList`: `{ transactions: [{ id, amountVnd, reference,
 * payer, occurredAt }] }`, the raw rows the account kept as the provider sent them).
 */
const creditRow = z.object({
    id: idSchema,
    amountVnd: z.number().int(),
    reference: z.string().max(400).nullable(),
})
const creditList = z.object({ transactions: z.array(creditRow).max(LIST_MAX) })

/** The credit, exactly as the raw row holds it. */
const output = z.object({
    transactionRef: idSchema.describe("The `id` of the credit, as the credit list answered it."),
    amountVnd: z.number().int().describe("The amount received, in whole VND."),
    reference: z.string().max(400).nullable().describe("The transfer text the payer wrote; null when none."),
})

/** The credit list's args: the newest credits, as many as one read lists. */
const CREDIT_ARGS = { limit: LIST_MAX }

const creditOf = (id: string, amountVnd: number, reference: string) => ({
    id,
    amountVnd,
    reference,
    payer: "CONG TY MAU",
    occurredAt: "2026-11-12T02:00:00.000Z",
})

const CREDIT = creditOf("tx-0077", 1_188_000, "GH8K2Q chuyen tien gia han")

/**
 * `webbooks.payment-credit` (Read the credit): the raw bank row the credit trigger names, read through the provider's generic read of
 * received credits (`TOOL.paymentCreditList`: the account's raw rows as the provider sent them) and picked by an exact id equality. No
 * model, no comparison with any request: the next steps do both. A row the list does not hold is not clear: confused, with the facts,
 * so the founder decides. The transfer text is a person's words (private).
 */
export const webbooksPaymentCreditNode: TemplateNode = defineTemplateNode({
    id: "webbooks.payment-credit",
    title: webbooksText("node.payment-credit.title"),
    description: { vi: "\u0110\u1ecdc kho\u1ea3n ti\u1ec1n ng\u00e2n h\u00e0ng v\u1eeba b\u00e1o c\u00f3.", en: "Reads the bank credit that just came in." },
    tools: [TOOL.paymentCreditList],
    mode: "auto",
    accounts: [PROVIDER.sepay, PROVIDER.casso],
    input,
    output,
    sensitive: { reference: "pii" },
    run: async (given, ctx) => {
        const listed = await ctx.tools.call(TOOL.paymentCreditList, CREDIT_ARGS)
        if (!listed.ok)
            return ctx.fail(
                { kind: "confused", question: null },
                { transactionId: given.transactionId, refusal: listed.refusal },
            )
        const credit = creditList.parse(listed.value).transactions.find((row) => row.id === given.transactionId)
        if (credit === undefined)
            return ctx.fail({ kind: "confused", question: null }, { transactionId: given.transactionId, found: false })
        return { transactionRef: credit.id, amountVnd: credit.amountVnd, reference: credit.reference }
    },
    examples: [
        {
            name: "picks the credit the trigger names out of the account's raw rows, by its id",
            params: {},
            input: { transactionId: "tx-0077" },
            tools: [
                {
                    id: TOOL.paymentCreditList,
                    args: CREDIT_ARGS,
                    answer: creditsOk({ transactions: [creditOf("tx-0001", 50_000, "ung ho"), CREDIT] }),
                },
            ],
            output: { transactionRef: "tx-0077", amountVnd: 1_188_000, reference: "GH8K2Q chuyen tien gia han" },
        },
        {
            name: "the credit list does not hold the credit: confused, with the facts, for the founder",
            params: {},
            input: { transactionId: "tx-9999" },
            tools: [{ id: TOOL.paymentCreditList, args: CREDIT_ARGS, answer: creditsOk({ transactions: [CREDIT] }) }],
            failure: { kind: "confused", question: null },
        },
        // No refusal example: the credit list reads the account's own raw rows and has no business refusal; no bank feed connected is
        // `not_connected`, which freezes the step before the node sees it.
    ],
})
