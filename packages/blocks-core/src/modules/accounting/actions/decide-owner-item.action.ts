import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import { outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { ANSWER_COMMAND } from "../../../rules/accounting/questions"
import { OTHER_INCOME_KIND, RESOLVE_COMMAND } from "../../../rules/accounting/resolve"
import { membersPort } from "../../platform/ports"
import { textOf } from "../messages/copy"
import { CLAIMS, ORDERS, QUESTIONS, TRANSACTIONS } from "../ports"
import { answerOwnerQuestion } from "./answer-question.action"
import { resolveUnmatched } from "./resolve-unmatched-payment.action"

/** The longest answer the door accepts. */
const ANSWER_MAX = 2_000

const input: z.ZodObject<{
    id: z.ZodString
    command: z.ZodEnum<{ "accounting.resolve-unmatched-payment": "accounting.resolve-unmatched-payment"; edit: "edit" }>
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
 * `accounting.decide-owner-item`: the one action of the "needs you" queue. It runs what the owner chose on an item of the queue under
 * the command the row sent: `accounting.resolve-unmatched-payment` ties a payment to an order or records it as other income (the same
 * writes and refusals as `accounting.resolve-unmatched-payment`), `edit` answers a question (the same as `accounting.answer-question`).
 */
export const decideOwnerItemAction: ActionDefinition = defineAction({
    id: "accounting.decide-owner-item",
    permission: "accounting.manage",
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
        "accounting.owner-queue",
        "accounting.today",
        "accounting.decisions",
        "accounting.figures",
        "accounting.entries",
        "accounting.ledger",
        "accounting.questions",
        "accounting.question-count",
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
