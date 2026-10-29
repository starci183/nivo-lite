import type { WorkThread } from "@modules/domain/work-threads"
import type { ThreadDigestRecord, ThreadListing, ThreadMessage, ThreadMessageRecord } from "./thread-messages.contracts"

/** A thread with its digest: the newest line, the count and whether an approval waits; a thread with no message has an empty one. */
export const toListing = (thread: WorkThread, digest: ThreadDigestRecord | undefined): ThreadListing => ({
    ...thread,
    lastBody: digest === undefined ? null : digest.last_body,
    lastAt: digest === undefined ? null : digest.last_at.toISOString(),
    messageCount: digest === undefined ? 0 : digest.message_count,
    waitingApproval: digest?.waiting_approval === true,
})

/** One message row as the API reads it. */
export const toMessage = (row: ThreadMessageRecord): ThreadMessage => ({
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
    createdAt: row.created_at.toISOString(),
})
