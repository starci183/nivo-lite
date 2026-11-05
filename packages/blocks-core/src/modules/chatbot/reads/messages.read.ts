import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListPage, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { threadLineOf } from "../../../rules/chatbot"
import type { ThreadLine } from "../../../rules/chatbot"
import { CONVERSATIONS, MESSAGES } from "../ports"

/** The lines a page of the thread holds. */
export const MESSAGES_PAGE_SIZE = 50

/**
 * The lines of one conversation as the thread block reads them, newest page first with a cursor to older ones. It is a plain read,
 * not a list read: the page is scoped to the chosen conversation, which a list source does not receive.
 */
export const THREAD_MESSAGES: ReadDefinition = defineRead({
    id: "chatbot.messages",
    dataKind: "message",
    shape: "list",
    fields: ["id", "text", "who", "at", "side", "state", "mark"],
    paths: { rows: "list" },
    variables: z.object({ threadId: z.string().min(1).max(MAX_ID), cursor: z.string().max(MAX_ID).optional() }),
    permission: "chatbot.view",
    ports: { conversations: CONVERSATIONS, messages: MESSAGES },
    run: async ({ conversations, messages }, { threadId, cursor }): Promise<ListPage<ThreadLine>> => {
        const conversation = await conversations.get(threadId)
        if (conversation === null) return { rows: [], cursor: null }
        const page = await messages.page(threadId, cursor ?? null, MESSAGES_PAGE_SIZE)
        return { rows: page.rows.map((line) => threadLineOf(line, conversation.name)), cursor: page.cursor }
    },
})
