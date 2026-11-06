import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { ANSWER_COMMAND } from "../../../rules/accounting/questions"
import { textOf } from "../messages/copy"
import { questionListPort } from "../ports"

/** The longest answer the door accepts. */
const ANSWER_MAX = 2_000

const input: z.ZodObject<{
    id: z.ZodString
    command: z.ZodLiteral<typeof ANSWER_COMMAND>
    values: z.ZodObject<{ answer: z.ZodString }>
}> = z.object({
    id: z.string().min(1).max(MAX_ID),
    command: z.literal(ANSWER_COMMAND),
    values: z.object({ answer: z.string().max(ANSWER_MAX) }),
})

/**
 * `accounting.answer-question`: the owner answers a question the accounting department asked. An empty answer is refused naming the
 * field; a question that is gone or already answered is refused as data.
 */
export const answerQuestionAction: ActionDefinition = defineAction({
    id: "accounting.answer-question",
    permission: "accounting.manage",
    label: textOf("answer_question"),
    input,
    ports: { list: questionListPort },
    transactional: true,
    refreshes: ["accounting.questions", "accounting.question-count"],
    run: async ({ list }, { id, values }, context): Promise<ActionResult> => {
        const answer = values.answer.trim()
        if (answer === "") {
            const message = textOf("answer_empty")
            return { ok: false, reason: "invalid", message, fields: { answer: message } }
        }
        const written = await list.answer(id, answer, context.memberId ?? "system")
        return written.ok ? { ok: true } : { ok: false, reason: "refused", message: textOf("answer_closed") }
    },
})
