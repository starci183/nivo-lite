import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListQuery, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { chatFiguresOf } from "../../../rules/chatbot/figures"
import type { ChatFigures } from "../../../rules/chatbot/figures"
import { THREADS_LIST } from "../ports"
import { THREADS_SHAPE } from "./threads.read"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The query that counts every conversation. */
export const ALL_THREADS: ListQuery = { q: null, filters: {}, sort: "recent", cursor: null, size: 1 }

/** `chatbot.figures`: the conversations, the share the AI answers, who waits for a person and who holds one. */
export const FIGURES: ReadDefinition = defineRead({
    id: "chatbot.figures",
    dataKind: "conversation",
    shape: "record",
    fields: ["total", "aiShare", "needsCount", "handledCount"],
    paths: {},
    variables,
    permission: "chatbot.view",
    ports: { threads: THREADS_LIST },
    run: async ({ threads }): Promise<ChatFigures> =>
        chatFiguresOf(await threads.counts(THREADS_SHAPE, "status", ALL_THREADS)),
})
