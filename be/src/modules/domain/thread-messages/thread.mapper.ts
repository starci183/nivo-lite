import type { WorkThread } from "@modules/domain/work-threads"
import type { ThreadListing, ThreadMessage } from "./thread-messages.contracts"
import type { ThreadDigestRow, ThreadMessageRow } from "./persistence/thread-messages.rows"

const instantOf = (value: string): string => new Date(value).toISOString()

/** A thread with its digest: the newest line, the count and whether an approval waits; a thread with no message has an empty one. */
export const toListing = (thread: WorkThread, digest: ThreadDigestRow | undefined): ThreadListing => ({
    ...thread,
    lastBody: digest === undefined ? null : digest.last_body,
    lastAt: digest === undefined ? null : instantOf(digest.last_at),
    messageCount: digest === undefined ? 0 : digest.message_count,
    waitingApproval: digest !== undefined && digest.waiting_approval,
})

/** One message row as the API reads it. */
export const toMessage = (row: ThreadMessageRow): ThreadMessage => ({
    id: row.id,
    threadId: row.thread_id,
    authorKind: row.author_kind === "agent" ? "agent" : "member",
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    body: row.body,
    quoted: row.quoted,
    mentions: row.mentions,
    approval: row.approval,
    createdAt: instantOf(row.created_at),
})
