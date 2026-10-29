/** The caller's read marker of one agent's direct conversation (ISO text with microseconds); null while nothing was read. */
export interface AgentChatMark {
    /** The agent. */
    readonly agentId: string
    /** The instant the caller read up to. */
    readonly readAt: string | null
}

/** The newest line of an agent's test chats. */
export interface AgentChatLine {
    /** The line id. */
    readonly id: string
    /** The text. */
    readonly body: string
    /** The account that wrote it; null for the agent's own lines and unattributed legacy ones. */
    readonly author_user_id: string | null
    /** The name written on the line; null when none was. */
    readonly author_name: string | null
    /** When it was written, ISO 8601 as the database JSON timestamp renders it. */
    readonly at: string
}

/** The unread count and newest line of an agent's test chats. */
export interface AgentChats {
    /** The agent. */
    readonly agentId: string
    /** Lines the caller has not read across the agent's test chats, at most 99. */
    readonly unread: number
    /** The newest line across them; undefined while nobody wrote. */
    readonly newest: AgentChatLine | undefined
}
