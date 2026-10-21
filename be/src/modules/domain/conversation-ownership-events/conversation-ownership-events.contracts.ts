import type { EntityManager } from "typeorm"

/** One move of a customer conversation from one agent to another, recorded in the transaction that moved it. */
export interface RecordOwnershipMoveParams {
    /** The transaction that moved the conversation; the record commits or rolls back with the move. */
    readonly manager: EntityManager
    /** The workspace of the conversation. */
    readonly workspaceId: string
    /** The conversation that moved. */
    readonly conversationId: string
    /** The agent that held it before; null when no agent did. */
    readonly fromAgentId: string | null
    /** The agent that holds it now. */
    readonly toAgentId: string
    /** Why it moved, the hand-off note in one line (1 to 400 characters, as the table's check allows). */
    readonly reason: string
}
