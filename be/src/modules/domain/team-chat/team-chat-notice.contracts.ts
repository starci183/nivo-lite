/** A plain line NIVO tells the founder in the NIVO room: the words, and the key that makes a repeat of the same episode one line. */
export interface NivoNotice {
    /** What the line is about and which episode: the same key is the same line, written once. */
    readonly key: string
    /** The words, already in the founder's language. */
    readonly body: string
}

/** How a notice went: posted now, already posted for this key, or not posted (the workspace has no owner). */
export type NoticePosted = "posted" | "already" | "no_owner"

/** An event that was not delivered to an agent because its chain of agents hit a limit: what the founder is told. */
export interface ChainStop {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent that was not woken. */
    readonly agentId: string
    /** How many agent wakes led to the event. */
    readonly depth: number
    /** Why it stopped. */
    readonly reason: string
    /** The event type. */
    readonly eventType: string
}
