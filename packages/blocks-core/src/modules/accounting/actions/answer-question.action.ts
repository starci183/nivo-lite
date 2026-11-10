import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { ANSWER_COMMAND } from "../../../rules/accounting/questions"
import { membersPort } from "../../platform/ports"
import type { MemberDirectory } from "../../platform/platform.types"
import { answerQuestion } from "../accounting-data"
import { textOf } from "../messages/copy"
import { QUESTIONS } from "../ports"

/** The longest answer the door accepts. */
const ANSWER_MAX = 2_000

/** Who an answer is credited to when no seat of the workspace gave it: the system. */
const SYSTEM = "system"

const input: z.ZodObject<{
    id: z.ZodString
    command: z.ZodLiteral<typeof ANSWER_COMMAND>
    answer: z.ZodString
}> = z.object({
    id: z.string().min(1).max(MAX_ID),
    command: z.literal(ANSWER_COMMAND),
    answer: z.string().max(ANSWER_MAX),
})

/** The ports an answer runs on. */
export interface AnswerPorts {
    /** The questions. */
    readonly questions: EntityApi
    /** The seats of the workspace. */
    readonly members: MemberDirectory
}

/** What an answer says and which question it closes. */
export interface OwnerAnswer {
    /** The question. */
    readonly id: string
    /** The words of the answer. */
    readonly answer: string
}

/** Records the answer of the owner (a member seat or the system); an empty answer or a closed question is refused. */
export const answerOwnerQuestion = async (
    { questions, members }: AnswerPorts,
    { id, answer: given }: OwnerAnswer,
    memberId: string | null,
): Promise<ActionResult> => {
    const answer = given.trim()
    if (answer === "") {
        const message = textOf("answer_empty")
        return { ok: false, reason: "invalid", message, fields: { answer: message } }
    }
    const member = memberId === null ? null : await members.get(memberId)
    const written = await answerQuestion(questions, id, answer, member?.displayName ?? SYSTEM)
    return written.ok ? { ok: true } : { ok: false, reason: "refused", message: textOf("answer_closed") }
}

/**
 * `accounting.answer-question`: the owner answers a question the accounting department asked. An empty answer is refused naming the
 * field; a question that is gone or already answered is refused as data.
 */
export const answerQuestionAction: ActionDefinition = defineAction({
    id: "accounting.answer-question",
    permission: "accounting.manage",
    label: textOf("answer_question"),
    input,
    ports: { questions: QUESTIONS, members: membersPort },
    transactional: true,
    refreshes: ["accounting.questions", "accounting.question-count"],
    run: (ports, given, context): Promise<ActionResult> => answerOwnerQuestion(ports, given, context.memberId),
})
