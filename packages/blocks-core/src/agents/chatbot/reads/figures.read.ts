import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListQuery, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { routeHoldsPort } from "@nivo-lite/agent-sdk/platform"
import { z } from "zod"
import { chatFiguresOf } from "../rules/figures"
import type { ChatFigures } from "../rules/figures"
import { THREADS_LIST } from "../ports"
import { THREADS_SHAPE } from "./threads.read"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The query that counts every conversation. */
export const ALL_THREADS: ListQuery = { q: null, filters: {}, sort: "recent", cursor: null, size: 1 }

/**
 * `blocks-core.chatbot.api.chat.figures`: the conversations, the share the AI answers, who waits for a person, and how many a member of the
 * shop holds now (the engine's route holds, `platform.route-holds` `held`, rulings R43 / R45).
 */
export const FIGURES: ReadDefinition = defineRead({
    id: "blocks-core.chatbot.api.chat.figures",
    dataKind: "conversation",
    shape: "record",
    fields: ["total", "aiShare", "needsCount", "heldCount"],
    paths: {},
    variables,
    permission: "chatbot.view",
    ports: { threads: THREADS_LIST, holds: routeHoldsPort },
    run: async ({ threads, holds }): Promise<ChatFigures> =>
        chatFiguresOf(await threads.counts(THREADS_SHAPE, "status", ALL_THREADS), (await holds.held(1)).count),
})
