import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListPage, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { customerMessagesPort } from "@nivo-lite/agent-sdk/platform"
import type { CustomerLine } from "@nivo-lite/agent-sdk/platform"
import { lineOrderSchema } from "@nivo-lite/agent-sdk/node"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { threadLineOf } from "../rules"
import type { StoredLine, ThreadLine } from "../rules"
import { membersPort } from "../../../shared/platform/ports"
import type { MemberDirectory } from "../../../shared/platform/platform.types"
import { threadRowOf } from "../chatbot-records"
import { CONVERSATIONS, NOTES } from "../ports"

/** The lines a page of the thread holds. */
export const MESSAGES_PAGE_SIZE = 50

/** The longest cursor a page of the thread is continued with: the engine's signed cursor. */
const CURSOR_MAX = 2_000

/** The words of a delivery state the thread shows: told, or did not arrive (refused, unknown); a claimed send is not told yet. */
const deliveryOf = (line: CustomerLine): string | null => {
    if (line.direction === "from_person" || line.state === null || line.state === "claimed") return null
    return line.state === "delivered" ? "sent" : "failed"
}

/** The line of the engine's conversation as the thread rules read it; a member's typed reply carries the member's name (read now). */
const storedLineOf = (line: CustomerLine, memberName: string | null): StoredLine => {
    const order = line.order === null ? null : lineOrderSchema.safeParse(line.order)
    return {
        id: line.id,
        role: line.direction === "from_person" ? "user" : "agent",
        text: line.text,
        sentAt: line.saidAt,
        authorKind: line.memberId === null ? "ai" : "human",
        authorName: memberName,
        deliveryStatus: deliveryOf(line),
        sentBy: line.agentId,
        files: line.files.map((file, index) => ({ id: `${line.id}:${index}`, url: file.url, name: file.name, contentType: file.contentType })),
        ...(order?.success === true ? { order: order.data } : {}),
    }
}

/** The names of the members who typed lines of a page, read once each. */
const memberNamesOf = async (members: MemberDirectory, lines: ReadonlyArray<CustomerLine>): Promise<ReadonlyMap<string, string>> => {
    const ids = [...new Set(lines.flatMap((line) => (line.memberId === null ? [] : [line.memberId])))]
    const found = await Promise.all(ids.map(async (id) => [id, (await members.get(id))?.displayName ?? null] as const))
    return new Map(found.flatMap(([id, name]) => (name === null ? [] : [[id, name] as const])))
}

/** The chatbot's notes of the conversation said between two instants (inclusive; null = open), as notice lines. */
const notesBetween = async (
    notes: EntityApi,
    conversationId: string,
    from: string | null,
    to: string | null,
): Promise<ReadonlyArray<StoredLine>> => {
    const page = await notes.list({
        select: ["text", "at"],
        where: q.and(
            q.eq("conversationId", conversationId),
            ...(from === null ? [] : [q.gte("at", from)]),
            ...(to === null ? [] : [q.lte("at", to)]),
        ),
        order: [
            ["at", "desc"],
            ["id", "desc"],
        ],
        page: { size: MESSAGES_PAGE_SIZE },
    })
    return page.rows.flatMap(({ row }): Array<StoredLine> => {
        const text = row.data["text"]
        const at = row.data["at"]
        return typeof text === "string" && typeof at === "string"
            ? [{ id: `note:${row.id}`, role: "system", text, sentAt: at, authorKind: null, authorName: null, deliveryStatus: null, sentBy: null }]
            : []
    })
}

/** The lines of a page and the notes said within it, newest first (a line before a note of the same instant). */
const newestFirst = (lines: ReadonlyArray<ThreadLine>): ReadonlyArray<ThreadLine> =>
    [...lines].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

/**
 * The lines of one conversation as the thread block reads them, newest page first with a cursor to older ones (MESSAGES-PLAN section 5,
 * owner ruling R26). The words are the ENGINE's: the route's lines from `platform.customer-messages`, both directions, every agent's and
 * the members' typed replies, from the chat's `startedAt` (a Telegram `/start` opens a new chat whose window starts there). A sent line
 * that did not arrive (refused, unknown) shows as one that did not arrive; a claimed send is shown once the engine settles it. Beside
 * them stand the chatbot's own notes (a person took the thread over or gave it back) said within the page. A chat with no route yet
 * has no line.
 */
export const THREAD_MESSAGES: ReadDefinition = defineRead({
    id: "blocks-core.chatbot.api.message.list",
    dataKind: "message",
    shape: "list",
    fields: ["id", "text", "who", "at", "side", "state", "mark", "sentBy", "files", "order"],
    paths: { rows: "list" },
    variables: z.object({ threadId: z.string().min(1).max(MAX_ID), cursor: z.string().max(CURSOR_MAX).optional() }),
    permission: "chatbot.view",
    ports: { conversations: CONVERSATIONS, notes: NOTES, lines: customerMessagesPort, members: membersPort },
    run: async ({ conversations, notes, lines, members }, { threadId, cursor }): Promise<ListPage<ThreadLine>> => {
        const record = await conversations.get(threadId)
        const conversation = record === null ? null : threadRowOf(record)
        if (conversation === null || conversation.routeId === null) return { rows: [], cursor: null }
        const page = await lines.byRoute(conversation.routeId, {
            limit: MESSAGES_PAGE_SIZE,
            since: conversation.startedAt,
            ...(cursor === undefined ? {} : { after: cursor }),
        })
        const names = await memberNamesOf(members, page.lines)
        const said = page.lines.map((line) =>
            threadLineOf(storedLineOf(line, line.memberId === null ? null : (names.get(line.memberId) ?? null)), conversation.name),
        )
        // The notes said within this page: from its oldest line (the whole window on the last page) up to its newest (now on the first).
        const from = page.next === null ? conversation.startedAt : (page.lines.at(-1)?.saidAt ?? null)
        const to = cursor === undefined ? null : (page.lines[0]?.saidAt ?? null)
        const noted = (await notesBetween(notes, threadId, from, to)).map((line) => threadLineOf(line, conversation.name))
        return { rows: [...newestFirst([...said, ...noted])], cursor: page.next }
    },
})
