/** A person's reply to a line an agent wrote under a key. */
export interface AgentLineReplied {
    /** The workspace. */
    readonly workspaceId: string
    /** The person who replied. */
    readonly byUserId: string
    /** The stored key of the agent's line (`lineKeyOf` of the key it was posted under). */
    readonly lineKey: string
    /** The reply message itself (always set by the chat; optional only so older callers still compile). */
    readonly messageId?: string | undefined
    /** The words of the reply (always set by the chat). */
    readonly text?: string | undefined
    /** When the reply was written, ISO text from the database clock (always set by the chat). */
    readonly at?: string | undefined
}

/** What hears a person's reply to an agent's line. */
export type AgentLineReplyListener = (reply: AgentLineReplied) => Promise<void>

/** The room a person wrote in, as the team chat already holds it (no read is made to know it). */
export interface HeardRoom {
    /** The room. */
    readonly id: string
    /** `direct` (a pair) or `group`. */
    readonly kind: "direct" | "group"
    /** The sorted pair of a direct room (`"agent:<id>|user:<id>"`); null for a group. */
    readonly directKey: string | null
}

/** The stored message a person just wrote, as its one line listener hears it. */
export interface HeardMessage {
    /** The message. */
    readonly id: string
    /** Its words. */
    readonly body: string
    /** When it was written, ISO. */
    readonly createdAt: string
}

/** The line a person's message replies to, as the team chat already read it to check the reply. */
export interface HeardReply {
    /** The message. */
    readonly id: string
    /** `user`, `agent` or `system`. */
    readonly authorKind: string
    /** The account or the agent; null for a system line. */
    readonly authorId: string | null
    /** `text`, `report`, `approval` or `system`. */
    readonly kind: string
    /** The structured message an agent line carries, as stored JSON text; null for a plain line. */
    readonly agentMessage: string | null
    /** Its words. */
    readonly body: string
    /** When it was written, ISO. */
    readonly createdAt: string
}

/** A person's new message as its one line listener hears it (the turn router reads only these fields; no read is needed). */
export interface PersonLineHeard {
    /** The workspace. */
    readonly workspaceId: string
    /** The account of the person who wrote it. */
    readonly userId: string
    /** Where. */
    readonly room: HeardRoom
    /** The message. */
    readonly message: HeardMessage
    /** The AGENTS the message names, in the order written, once each. */
    readonly agentMentions: ReadonlyArray<string>
    /** The line it replies to, or null. */
    readonly repliedTo: HeardReply | null
}

/** Hears a person's new message; answers the agents whose chat turn it took (the old tag path skips them). */
export type PersonLineListener = (line: PersonLineHeard) => Promise<ReadonlyArray<string>>

/** One reply of a person, as the engine reads it. */
export interface AgentLineReply {
    /** The words. */
    readonly text: string
    /** When they were written, ISO text. */
    readonly at: string
}
