import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { chatDecisionQueueOf } from "../../../rules/chatbot/decisions"
import type { DecisionQueueView } from "../../../views/views.types"
import { THREADS_LIST } from "../ports"
import { ALL_THREADS } from "./figures.read"
import { THREADS_SHAPE } from "./threads.read"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most waiting conversations the queue lists. */
export const DECISIONS_SHOWN = 5

/** `chatbot.decisions`: the customers who wait for a person, newest activity first, each to take over. */
export const DECISIONS: ReadDefinition = defineRead({
    id: "chatbot.decisions",
    dataKind: "chatbot-decision",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: "chatbot.view",
    ports: { threads: THREADS_LIST },
    run: async ({ threads }): Promise<DecisionQueueView> => {
        const page = await threads.page(THREADS_SHAPE, {
            ...ALL_THREADS,
            filters: { status: "needs" },
            size: DECISIONS_SHOWN,
        })
        const counts = await threads.counts(THREADS_SHAPE, "status", ALL_THREADS)
        return chatDecisionQueueOf(page.rows, counts.needs ?? 0)
    },
})
