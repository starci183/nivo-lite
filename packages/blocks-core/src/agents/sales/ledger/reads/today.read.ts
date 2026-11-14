import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { todayFiguresOf, todayRangeOf, type TodayFigures } from "../rules/today"
import { openQuestionCount, unmatchedIn } from "../accounting-data"
import { creditsIn } from "../accounting-today-data"
import { QUESTIONS, TRANSACTIONS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `blocks-core.sales.api.entry.today`: the money received today (the shop's day), how much of it was matched, how much was not, and what waits for the owner. */
export const todayRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.entry.today",
    dataKind: "accounting-today",
    shape: "record",
    fields: [
        "receivedVnd",
        "matchedCount",
        "unmatchedCount",
        "waitingCount",
        "receivedHint",
        "matchedHint",
        "unmatchedHint",
        "waitingHint",
    ],
    paths: {},
    variables,
    permission: "sales.view",
    ports: { transactions: TRANSACTIONS, questions: QUESTIONS },
    run: async ({ transactions, questions }, _given, context): Promise<TodayFigures> => {
        const day = todayRangeOf(context.now)
        const [credits, unmatched, waiting] = await Promise.all([
            creditsIn(transactions, day),
            unmatchedIn(transactions, day),
            openQuestionCount(questions),
        ])
        return todayFiguresOf({
            received: credits.received,
            matched: credits.matched,
            unmatched,
            waitingQuestions: waiting,
        })
    },
})
