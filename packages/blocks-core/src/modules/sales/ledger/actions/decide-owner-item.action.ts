import { defineAction, type ActionDefinition, type ActionResult } from "@nivo-lite/agent-sdk/block"
import { outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { z } from "zod"
import { MAX_ID } from "../../../../bounds"
import { ANSWER_COMMAND } from "../../../../rules/sales/ledger/questions"
import { OTHER_INCOME_KIND, RESOLVE_COMMAND } from "../../../../rules/sales/ledger/resolve"
import { membersPort } from "../../../platform/ports"
import { textOf } from "../messages/copy"
import { CLAIMS, ORDERS, QUESTIONS, TRANSACTIONS } from "../ports"
import { answerOwnerQuestion } from "./answer-question.action"
import { resolveUnmatched } from "./resolve-unmatched-payment.action"

/** The longest answer the door accepts. */
const ANSWER_MAX = 2_000

const input: z.ZodObject<{
    id: z.ZodString
    command: z.ZodEnum<{ "sales.resolve-unmatched-payment": "sales.resolve-unmatched-payment"; edit: "edit" }>
    order: z.ZodOptional<z.ZodUUID>
    kind: z.ZodOptional<z.ZodLiteral<typeof OTHER_INCOME_KIND>>
    answer: z.ZodOptional<z.ZodString>
}> = z.object({
    id: z.string().min(1).max(MAX_ID),
    command: z.enum([RESOLVE_COMMAND, ANSWER_COMMAND]),
    order: z.uuid().optional(),
    kind: z.literal(OTHER_INCOME_KIND).optional(),
    answer: z.string().max(ANSWER_MAX).optional(),
})

const refused: ActionResult = { ok: false, reason: "invalid", message: textOf("decide_invalid") }

/**
 * `sales.decide-owner-item`: the one action of the "needs you" queue. It runs what the owner chose on an item of the queue under
 * the command the row sent: `sales.resolve-unmatched-payment` ties a payment to an order or records it as other income (the same
 * writes and refusals as `sales.resolve-unmatched-payment`), `edit` answers a question (the same as `sales.answer-question`).
 */
export const decideOwnerItemAction: ActionDefinition = defineAction({
    id: "sales.decide-owner-item",
    permission: "sales.manage",
    label: textOf("decide_owner_item"),
    input,
    ports: {
        transactions: TRANSACTIONS,
        orders: ORDERS,
        claims: CLAIMS,
        outbox: outboxPort,
        questions: QUESTIONS,
        members: membersPort,
    },
    transactional: true,
    refreshes: [
        "blocks-core.sales.api.question.owner-queue",
        "blocks-core.sales.api.entry.today",
        "blocks-core.sales.api.transaction.decisions",
        "blocks-core.sales.api.entry.figures",
        "blocks-core.sales.api.entry.list",
        "blocks-core.sales.api.entry.ledger",
        "blocks-core.sales.api.question.list",
        "blocks-core.sales.api.question.count",
    ],
    run: (ports, given, context): Promise<ActionResult> => {
        if (given.command === ANSWER_COMMAND)
            return given.answer === undefined
                ? Promise.resolve(refused)
                : answerOwnerQuestion(ports, { id: given.id, answer: given.answer }, context.memberId)
        // A payment is tied to an order or recorded as other income: exactly one of the two.
        if ((given.order === undefined) === (given.kind === undefined) || !z.uuid().safeParse(given.id).success)
            return Promise.resolve(refused)
        return resolveUnmatched(ports, { id: given.id, order: given.order })
    },
})
