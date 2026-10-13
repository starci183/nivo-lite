import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CardClosing, CardRecord, OptionalCardRecord, ProposedCardRecord } from "./module-setup-writes.contracts"
import { CLOSE_CARD, FIND_CARD, INSERT_CARDS, LIST_CARDS, SUPERSEDE_CARDS } from "./persistence/module-setup-writes.sql"

@Injectable()
/** The confirm cards of the setup chat: the only owner of the module_setup_writes table. */
export class SetupWritesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The cards of the given sessions, oldest first; superseded cards are left out. */
    ofSessions(sessionIds: ReadonlyArray<string>): Promise<ReadonlyArray<CardRecord>> {
        return sessionIds.length === 0
            ? Promise.resolve([])
            : this.entityManager.query<Array<CardRecord>>(LIST_CARDS, [sessionIds])
    }

    /** One card of the workspace by id; null when there is none. */
    async find(workspaceId: string, cardId: string): Promise<OptionalCardRecord> {
        const [row] = await this.entityManager.query<Array<CardRecord>>(FIND_CARD, [cardId, workspaceId])
        return row ?? null
    }

    /** Stores the cards a turn proposed; a card replaces the waiting card of the same target. */
    async propose(
        workspaceId: string,
        sessionId: string,
        sourceMessageId: string,
        cards: ReadonlyArray<ProposedCardRecord>,
    ): Promise<void> {
        if (cards.length === 0) return
        await this.entityManager.transaction(async (tx) => {
            await tx.query(SUPERSEDE_CARDS, [sessionId, cards.map((card) => card.target_key)])
            await tx.query(INSERT_CARDS, [workspaceId, sessionId, sourceMessageId, JSON.stringify(cards)])
        })
    }

    /** Closes a waiting card as applied or rejected; null when it was decided already. */
    async close(workspaceId: string, cardId: string, closing: CardClosing): Promise<OptionalCardRecord> {
        const [row] = await this.entityManager.query<Array<CardRecord>>(CLOSE_CARD, [
            cardId,
            workspaceId,
            closing.status,
            JSON.stringify(closing.payload),
            JSON.stringify(closing.result),
            closing.decidedBy,
        ])
        return row ?? null
    }
}
