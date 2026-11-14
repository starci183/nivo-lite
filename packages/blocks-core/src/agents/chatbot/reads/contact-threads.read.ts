import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { customerMessagesPort, membersPort, routeHoldsPort } from "@nivo-lite/agent-sdk/platform"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { CONVERSATION_FIELDS, threadRowOf } from "../chatbot-records"
import type { ThreadRow } from "../chatbot.types"
import { CONVERSATIONS } from "../ports"
import { withLastLines } from "./last-lines"
import { withHolders } from "./route-holder"

/** The most conversations one read answers for a contact: the contact detail shows the first rows, the inbox holds the rest. */
export const CONTACT_THREADS_PAGE = 5

/** The conversation as the contact detail draws it: who wrote, from where, where it stands and its last words; nothing of the record's bookkeeping. */
export interface ContactThread {
    /** The conversation id. */
    readonly id: string
    /** The name the inbox shows. */
    readonly name: string
    /** The channel code. */
    readonly channel: string
    /** Where it stands in the inbox. */
    readonly status: string
    /** The preview of the last line said in the chat's window (the engine's line); empty when none. */
    readonly lastText: string
    /** The chatbot's activity stamp, as ISO 8601; null before any. */
    readonly lastAt: string | null
}

/**
 * The conversations of ONE contact (the Chatbot's own chats, newest activity first), each with the last line said on its route from the
 * ENGINE's conversation (`platform.customer-messages`, ruling R26) and its status shown from the ENGINE's staff hold of the route
 * (`platform.route-holds`, ruling R43): the read behind the Chatbot's block on the contact detail. The contact
 * id follows a merge, so a person merged from two contacts shows both their conversations.
 */
export const CONTACT_THREADS: ReadDefinition = defineRead({
    id: "blocks-core.chatbot.api.chat.of-contact",
    dataKind: "conversation",
    shape: "list",
    fields: ["rows"],
    paths: { rows: "list" },
    permission: "chatbot.view",
    variables: z.object({ contactId: z.string().min(1).max(MAX_ID) }),
    ports: { conversations: CONVERSATIONS, lines: customerMessagesPort, holds: routeHoldsPort, members: membersPort },
    run: async ({ conversations, lines, holds, members }, { contactId }): Promise<{ rows: ReadonlyArray<ContactThread>; cursor: string | null }> => {
        const page = await conversations.list({
            select: CONVERSATION_FIELDS,
            where: q.eq("contactId", contactId),
            order: [
                ["lastAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: CONTACT_THREADS_PAGE },
        })
        const chats = page.rows.flatMap((listed): ReadonlyArray<ThreadRow> => {
            const chat = threadRowOf(listed.row)
            return chat === null ? [] : [chat]
        })
        const joined = await withHolders(holds, members, await withLastLines(lines, chats))
        return {
            rows: joined.map((chat) => ({
                id: chat.id,
                name: chat.name,
                channel: chat.channel,
                status: chat.status,
                lastText: chat.lastText,
                lastAt: chat.lastAt,
            })),
            cursor: page.next,
        }
    },
})
