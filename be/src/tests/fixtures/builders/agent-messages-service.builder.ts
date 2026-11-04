import { In, MoreThan, MoreThanOrEqual, Not } from "typeorm"
import type { FindManyOptions } from "typeorm"
import { messageOf } from "@tests/fixtures/builders/agent-messages.builder"

/** The options of the `find` that reads the lines (id, body, time) of a conversation, for the given `where`, order and `take`. */
export const lineFindOptions = (where: object, take: number): FindManyOptions => ({
    select: { id: true, body: true, createdAt: true },
    where,
    order: { createdAt: "ASC", id: "ASC" },
    take,
})

/** The options of the first `listForConversations` read: no filter, newest first. */
export const LIST_NEWEST_FIRST: FindManyOptions = {
    select: { conversationId: true, role: true, body: true, createdAt: true },
    where: { workspaceId: "ws-1", conversationId: In(["conv-1", "conv-2"]) },
    order: { createdAt: "DESC", id: "ASC" },
    take: 20,
}

/** The options of the second `listForConversations` read: since a time, oldest first. */
export const LIST_OLDEST_SINCE: FindManyOptions = {
    select: { conversationId: true, role: true, body: true, createdAt: true },
    where: {
        workspaceId: "ws-1",
        conversationId: In(["conv-1"]),
        createdAt: MoreThanOrEqual(new Date("2026-10-12T10:00:00.000Z")),
    },
    order: { createdAt: "ASC", id: "ASC" },
    take: 5,
}

/** The options of the thread read of `listChat`. */
export const CHAT_THREAD_FIND: FindManyOptions = {
    select: { id: true, role: true, body: true, createdAt: true },
    where: { workspaceId: "ws-1", conversationId: "conv-1" },
    order: { createdAt: "ASC", id: "ASC" },
    take: 300,
}

/** The options of the read of `transcript`. */
export const TRANSCRIPT_FIND: FindManyOptions = {
    select: { role: true, body: true, createdAt: true },
    where: { conversationId: "conv-1", role: Not("system") },
    order: { createdAt: "DESC", id: "DESC" },
    take: 40,
}

/** The where of the customer lines among two ids. */
export const CUSTOMER_LINES_WHERE: object = { conversationId: "conv-1", id: In(["m-1", "m-2"]), role: "user" }

/** The where of the customer lines said after a reply at `replied`. */
export const unansweredWhere = (replied: Date): object => ({
    conversationId: "conv-1",
    role: "user",
    createdAt: MoreThan(replied),
})

/** One day's message count of one conversation, as the database groups it. */
interface DayCount {
    readonly conversationId: string
    readonly day: string
    readonly messages: number
}

/** The message counts of one day per conversation, as the database groups them; `c9` belongs to no counted channel. */
export const PER_CONVERSATION_COUNTS: ReadonlyArray<DayCount> = [
    { conversationId: "c1", day: "2026-10-12", messages: 3 },
    { conversationId: "c2", day: "2026-10-12", messages: 1 },
    { conversationId: "c3", day: "2026-10-12", messages: 2 },
    { conversationId: "c9", day: "2026-10-12", messages: 7 },
]

/** The channels of the counted conversations. */
export const COUNTED_CONVERSATIONS: ReadonlyArray<{ readonly id: string; readonly channel: string }> = [
    { id: "c1", channel: "facebook" },
    { id: "c2", channel: "facebook" },
    { id: "c3", channel: "zalo" },
]

/** The sums per day and channel of the counts above. */
export const MESSAGES_PER_DAY: ReadonlyArray<{
    readonly channel: string
    readonly day: string
    readonly messages: number
}> = [
    { channel: "facebook", day: "2026-10-12", messages: 4 },
    { channel: "zalo", day: "2026-10-12", messages: 2 },
]

/** The two bounds of the range of Vietnam days, as the query states them. */
export const RANGE_CLAUSES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
    ["m.createdAt >= (:from::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')", { from: "2026-10-05" }],
    ["m.createdAt < (:to::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')", { to: "2026-10-19" }],
]

/** Two stored messages of conversation `c1`, the first with an author kind and the second without. */
export const nodeMessages = (): Array<ReturnType<typeof messageOf>> => [
    messageOf({
        id: "m2",
        conversationId: "c1",
        role: "agent",
        authorKind: "bot",
        body: "b",
        createdAt: new Date(2000),
    }),
    messageOf({ id: "m1", conversationId: "c1", role: "user", body: "a", createdAt: new Date(1000) }),
]

/** What a graph node reads of those two messages: the author kind falls back to the role. */
export const NODE_ROWS: ReadonlyArray<Readonly<Record<string, string>>> = [
    { id: "m2", conversationId: "c1", authorKind: "bot", body: "b", createdAt: "1970-01-01T00:00:02.000Z" },
    { id: "m1", conversationId: "c1", authorKind: "user", body: "a", createdAt: "1970-01-01T00:00:01.000Z" },
]
