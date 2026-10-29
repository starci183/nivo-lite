import type { EntityManager } from "typeorm"
import { messagesEntities } from "@modules/domain/messages"

const [MessageEntity] = messagesEntities

/** What the database stored for a proof line's card. */
export interface ProofCardRow {
    /** The stored card, or null for an ordinary line. */
    readonly card: object | null
}

/**
 * Inserts a line through the database boundary, without the application parser, so the database's card check is what answers; the
 * card is any JSON object, or null for an ordinary line.
 */
export const insertProofCard = async (
    manager: EntityManager,
    workspaceId: string,
    card: object | null,
): Promise<Array<ProofCardRow>> => {
    const result = await manager
        .createQueryBuilder(MessageEntity, "m")
        .insert()
        .values({
            workspaceId,
            authorKind: "system",
            authorName: "Card validation proof",
            body: "Card validation proof",
            card,
        })
        .returning("card")
        .execute()
    return result.raw
}
