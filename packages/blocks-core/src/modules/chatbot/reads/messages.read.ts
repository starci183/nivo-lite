import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListPage, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { threadLineOf } from "../../../rules/chatbot"
import type { StoredLine, ThreadLine } from "../../../rules/chatbot"
import { MESSAGE_FIELDS, messageRecordOf, threadRowOf } from "../chatbot-records"
import { CONVERSATIONS, MESSAGES } from "../ports"

/** The lines a page of the thread holds. */
export const MESSAGES_PAGE_SIZE = 50

/** The longest cursor a page of the thread is continued with: the engine's signed cursor. */
const CURSOR_MAX = 2_000

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
    variables: z.object({ threadId: z.string().min(1).max(MAX_ID), cursor: z.string().max(CURSOR_MAX).optional() }),
    permission: "chatbot.view",
    ports: { conversations: CONVERSATIONS, messages: MESSAGES },
    run: async ({ conversations, messages }, { threadId, cursor }): Promise<ListPage<ThreadLine>> => {
        const record = await conversations.get(threadId)
        const conversation = record === null ? null : threadRowOf(record)
        if (conversation === null) return { rows: [], cursor: null }
        const page = await messages.list({
            select: MESSAGE_FIELDS,
            where: q.eq("conversationId", threadId),
            order: [
                ["sentAt", "desc"],
                ["id", "desc"],
            ],
            page: cursor === undefined ? { size: MESSAGES_PAGE_SIZE } : { size: MESSAGES_PAGE_SIZE, after: cursor },
        })
        const lines = page.rows.flatMap(({ row }): Array<StoredLine> => {
            const line = messageRecordOf(row)
            return line === null ? [] : [line]
        })
        return { rows: lines.map((line) => threadLineOf(line, conversation.name)), cursor: page.next }
    },
})
