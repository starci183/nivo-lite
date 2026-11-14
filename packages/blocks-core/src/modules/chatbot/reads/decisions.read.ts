import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { customerMessagesPort } from "@nivo-lite/agent-sdk/platform"
import { z } from "zod"
import { chatDecisionQueueOf } from "../../../rules/chatbot/decisions"
import type { DecisionQueueView } from "../../../views/views.types"
import { THREADS_LIST } from "../ports"
import { ALL_THREADS } from "./figures.read"
import { withLastLines } from "./last-lines"
import { THREADS_SHAPE } from "./threads.read"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most waiting conversations the queue lists. */
export const DECISIONS_SHOWN = 5

/**
 * `blocks-core.chatbot.api.chat.waiting`: the customers who wait for a person, newest activity first, each to take over, with the last
 * line said on the route (the engine's, ruling R26).
 */
export const DECISIONS: ReadDefinition = defineRead({
    id: "blocks-core.chatbot.api.chat.waiting",
    dataKind: "conversation",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: "chatbot.view",
    ports: { threads: THREADS_LIST, lines: customerMessagesPort },
    run: async ({ threads, lines }): Promise<DecisionQueueView> => {
        const page = await threads.page(THREADS_SHAPE, {
            ...ALL_THREADS,
            filters: { status: "needs" },
            size: DECISIONS_SHOWN,
        })
        const counts = await threads.counts(THREADS_SHAPE, "status", ALL_THREADS)
        return chatDecisionQueueOf(await withLastLines(lines, page.rows), counts.needs ?? 0)
    },
})
