import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { accountingQuestionsBlock } from "../../../blocks/sales/ledger/questions.block"
import type { QuestionsRecord } from "../../../rules/sales/ledger/question-rows"

/** The props of the questions list as the Accounting spec sets them. */
export const questionsFixtureProps: z.infer<(typeof accountingQuestionsBlock)["props"]> = {
    label: { vi: "C\u00e2u h\u1ecfi \u0111ang ch\u1edd b\u1ea1n", en: "Questions waiting for you" },
    empty: { vi: "Kh\u00f4ng c\u00f3 c\u00e2u h\u1ecfi n\u00e0o", en: "No question waits" },
}

/** The three questions of the canvas. */
export const QUESTIONS_WAITING: QuestionsRecord = {
    count: "3",
    rows: [
        {
            id: "q1",
            title: "Kho\u1ea3n 3.500.000 \u20ab t\u1eeb SePay thu\u1ed9c H\u0110-0139 hay H\u0110-0140?",
            description: "SePay \u00b7 CK HOA SEN SPA",
            askedAt: "2026-11-04T02:12:00.000Z",
        },
        {
            id: "q2",
            title: "\u0110\u01a1n #1088 \u0111\u00e3 ch\u1ed1t nh\u01b0ng ch\u01b0a c\u00f3 s\u1ed1 ti\u1ec1n, xu\u1ea5t h\u00f3a \u0111\u01a1n theo m\u1ee9c n\u00e0o?",
            description: "\u0110\u01a1n #1088",
            askedAt: "2026-11-03T08:00:00.000Z",
        },
        {
            id: "q3",
            title: "Phi\u1ebfu chi PC-0012 c\u00f3 t\u00ednh v\u00e0o chi ph\u00ed th\u00e1ng n\u00e0y kh\u00f4ng?",
            description: "PC-0012",
        },
    ],
}

/** The questions read in every status. */
export const questionsFixtures: Readonly<
    Record<"ready" | "waiting" | "empty" | "error" | "loading" | "forbidden", DataSlot<QuestionsRecord>>
> = {
    ready: { items: QUESTIONS_WAITING },
    waiting: { items: { count: "1", rows: QUESTIONS_WAITING.rows.slice(0, 1) } },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}
