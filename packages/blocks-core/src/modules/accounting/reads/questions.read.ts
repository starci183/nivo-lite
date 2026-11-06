import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import type { ItemsRegionView } from "../../../views/views.types"
import { questionsPort } from "../ports"

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
    ports: { questions: questionsPort },
    run: async ({ questions }): Promise<QuestionCount> => ({ count: await questions.waiting() }),
})

/** `accounting.questions`: the questions that wait for the owner, as the waiting region reads them: the count, with no rows to list. */
export const questionsRead: ReadDefinition = defineRead({
    id: "accounting.questions",
    dataKind: "accounting-questions",
    shape: "record",
    fields: ["count", "rows", "linkLabel", "linkHref", "more"],
    paths: { rows: "list" },
    variables,
    permission: "accounting.view",
    ports: { questions: questionsPort },
    run: async ({ questions }): Promise<ItemsRegionView> => {
        const waiting = await questions.waiting()
        return { count: waiting === 0 ? null : String(waiting), rows: [], linkLabel: "", linkHref: "", more: null }
    },
})
