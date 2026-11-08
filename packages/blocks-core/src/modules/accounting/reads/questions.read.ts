import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { questionQueueOf } from "../../../rules/accounting/questions"
import type { DecisionQueueView } from "../../../views/views.types"
import { openQuestionCount, waitingQuestions } from "../accounting-data"
import { QUESTIONS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** How many accounting questions wait for the owner, for the count on the tab. */
export interface QuestionCount {
    /** The questions that wait. */
    readonly count: number
}

/** `accounting.question-count`: how many questions wait for the owner. */
export const questionCountRead: ReadDefinition = defineRead({
    id: "accounting.question-count",
    dataKind: "accounting-question-count",
    shape: "record",
    fields: ["count"],
    paths: {},
    variables,
    permission: "accounting.view",
    ports: { questions: QUESTIONS },
    run: async ({ questions }): Promise<QuestionCount> => ({ count: await openQuestionCount(questions) }),
})

/** The most questions the queue lists. */
export const QUESTIONS_SHOWN = 20

/** `accounting.questions`: the questions that wait for the owner, as a queue whose edit form is the answer. */
export const questionsRead: ReadDefinition = defineRead({
    id: "accounting.questions",
    dataKind: "accounting-question",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: "accounting.view",
    ports: { questions: QUESTIONS },
    run: async ({ questions }): Promise<DecisionQueueView> =>
        questionQueueOf(await waitingQuestions(questions, QUESTIONS_SHOWN), await openQuestionCount(questions)),
})
