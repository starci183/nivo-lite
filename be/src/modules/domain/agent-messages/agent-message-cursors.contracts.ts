/** One conversation message as a receipt measures it: its id and its creation instant in the database's own text. */
export interface AgentMessageCursor {
    /** The message id. */
    readonly id: string
    /** The creation instant, in the database's own text, so no precision is lost. */
    readonly createdAt: string
}

/** A message position, or null when there is none. */
export type OptionalAgentMessageCursor = AgentMessageCursor | null

/** A creation instant in the database's own text, or null when there is none. */
export type OptionalCreatedAt = string | null
