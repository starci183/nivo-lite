import { defineJob, outboxPort, type JobDefinition, type OutboxApi } from "@nivo-lite/agent-sdk/mutation"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import {
    ambiguousSource,
    amountText,
    questionText,
    rematchOf,
    sinceOf,
    wrongAmountSource,
} from "../../../rules/accounting/rematch"
import type { TransactionRecord } from "../../../rules/accounting/accounting.types"
import { askQuestionOnce, orderById, unmatchedCreditsSince, workspaceSettings } from "../accounting-data"
import { settleOnOrder } from "../actions/settle.action"
import { copyOf } from "../messages/copy"
import { CLAIMS, ORDERS, QUESTIONS, SETTINGS, TRANSACTIONS } from "../ports"

/** The name of the job: the outbox enqueues it by this name. */
const JOB_NAME = "payment.rematch"

/** How many times the queue delivers the job before it is parked. */
const ATTEMPTS = 5

/** The most credits one sweep looks at. */
export const REMATCH_SWEPT = 100

const input: z.ZodObject<{ orderId: z.ZodUUID; at: z.ZodString }> = z.object({
    orderId: z.uuid(),
    at: z.string().min(1).max(40),
})

/** The port definitions of the job, by the name `run` reaches them by. */
type RematchPorts = {
    /** The payments. */
    readonly transactions: PortDefinition<EntityApi>
    /** The orders. */
    readonly orders: PortDefinition<EntityApi>
    /** The customers' payment claims, which a settlement answers. */
    readonly claims: PortDefinition<EntityApi>
    /** The outbox the jobs that follow a settlement are enqueued on. */
    readonly outbox: PortDefinition<OutboxApi>
    /** The questions the department asks the owner. */
    readonly questions: PortDefinition<EntityApi>
    /** The rules the workspace chose, which say how many days back a code looks. */
    readonly settings: PortDefinition<EntityApi>
}

const ports: RematchPorts = {
    transactions: TRANSACTIONS,
    orders: ORDERS,
    claims: CLAIMS,
    outbox: outboxPort,
    questions: QUESTIONS,
    settings: SETTINGS,
}

const payerOf = (credit: TransactionRecord): string => credit.payer ?? copyOf("rematch_unknown_payer", "vi")

/**
 * `payment.rematch`: a payment code was just issued for an order, so a credit that arrived BEFORE the code existed is looked for. It
 * sweeps the unmatched credits of the last days (the workspace's `rematchDays`, counted back from `at`, the instant the code was issued)
 * and judges each by the same code rule the arrival path uses. A credit that names the code with exactly the amount due settles the order
 * through the same path as an arrival (`settleOnOrder`: the order paid, the ledger line, the book entry, the notice). A credit that names
 * it with another amount (a partial or an over payment) goes to the owner as a question and is never settled; when several credits name
 * the code with the amount due, none is settled and the owner is asked once. It is safe to run again: a settled credit is no longer
 * unmatched, a settlement of an order already paid changes nothing, and each question is asked once for its source. The queue retries
 * and parks it, not the job.
 */
export const rematchJob: JobDefinition<typeof input, RematchPorts> = defineJob({
    name: JOB_NAME,
    input,
    ports,
    attempts: ATTEMPTS,
    run: async ({ transactions, orders, claims, outbox, questions, settings }, given) => {
        const order = await orderById(orders, given.orderId)
        if (order === null) return
        const days = (await workspaceSettings(settings)).rematchDays
        const credits = await unmatchedCreditsSince(transactions, sinceOf(given.at, days), REMATCH_SWEPT)
        const plan = rematchOf(order, credits)
        const due = order.amountVnd ?? 0
        await Promise.all(
            plan.wrongAmount.map((credit) =>
                askQuestionOnce(
                    questions,
                    wrongAmountSource(credit.id),
                    questionText(copyOf("rematch_wrong_amount", "vi"), {
                        amount: amountText(credit.amountVnd),
                        payer: payerOf(credit),
                        orderNo: order.orderNo,
                        due: amountText(due),
                    }),
                ),
            ),
        )
        if (plan.ambiguous.length > 1)
            await askQuestionOnce(
                questions,
                ambiguousSource(order.id),
                questionText(copyOf("rematch_ambiguous", "vi"), {
                    count: plan.ambiguous.length,
                    orderNo: order.orderNo,
                    amount: amountText(due),
                }),
            )
        if (plan.settle === null) return
        await settleOnOrder(
            { transactions, orders, claims, outbox },
            { transactionId: plan.settle.id, orderId: order.id },
        )
    },
})
