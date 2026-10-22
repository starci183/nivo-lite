import type { ApprovalCard, MentionView } from "../thread-messages.contracts"

/** The newest line, the count and the pending flag of one thread. */
export interface ThreadDigestRow {
    /** The thread. */
    readonly thread_id: string
    /** The newest message's text. */
    readonly last_body: string
    /** The newest message's instant as database text. */
    readonly last_at: string
    /** The number of messages. */
    readonly message_count: number
    /** Whether an approval card of the thread is pending. */
    readonly waiting_approval: boolean
}

/** One message joined with the name of its author. */
export interface ThreadMessageRow {
    /** The message id. */
    readonly id: string
    /** The thread. */
    readonly thread_id: string
    /** The workspace. */
    readonly workspace_id: string
    /** member or agent. */
    readonly author_kind: string
    /** The author id. */
    readonly author_id: string
    /** The author's display name, or empty. */
    readonly author_name: string
    /** The member's role or the agent's module, or empty. */
    readonly author_role: string
    /** The text. */
    readonly body: string
    /** The quoted customer words. */
    readonly quoted: ReadonlyArray<string>
    /** The tags with their chip names. */
    readonly mentions: ReadonlyArray<MentionView>
    /** The approval card, or null. */
    readonly approval: ApprovalCard | null
    /** Creation instant as database text. */
    readonly created_at: string
}

/** A message found through its approval request. */
export interface ApprovalMessageRow {
    /** The message id. */
    readonly id: string
    /** The workspace of the message. */
    readonly workspace_id: string
}

/** The id of a row an insert answered. */
export interface InsertedRow {
    /** The new row id. */
    readonly id: string
}

/** An agent of the workspace. */
export interface AgentRow {
    /** The agent id. */
    readonly id: string
    /** The agent's display name. */
    readonly name: string
}

/** A member of the workspace with the room they sit in. */
export interface MemberRefRow {
    /** The member id (workspace_members.id). */
    readonly id: string
    /** The display name. */
    readonly display_name: string
    /** owner, manager or staff. */
    readonly role: string
    /** The key of the room the member sits in, or null. */
    readonly room_key: string | null
}

/** An agent as the directory lists it. */
export interface AgentOptionRow {
    /** The agent id. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The agent's module. */
    readonly module: string
}

/** A room that has people in it. */
export interface RoomGroupRow {
    /** The room key. */
    readonly key: string
    /** The room name. */
    readonly name: string
}

/** The member id of a signed-in account. */
export interface MemberIdRow {
    /** The member id (workspace_members.id). */
    readonly id: string
}

/** The display name of a member. */
export interface MemberNameRow {
    /** The display name. */
    readonly display_name: string
}
