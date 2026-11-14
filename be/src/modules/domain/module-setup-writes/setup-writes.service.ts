import { Injectable } from "@nestjs/common"
import { In, Not, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CardClosing, CardRecord, OptionalCardRecord, ProposedCardRecord } from "./module-setup-writes.contracts"
import { ModuleSetupWriteEntity } from "./persistence/entities"

/** How many cards of the given sessions are read at once. */
const CARDS_LIMIT = 500

/** The only kind of card the setup chat writes and reads: a Second Brain fact. */
const FACT = "fact"

/** Maps a stored fact card to its contract. */
const toRecord = (row: ModuleSetupWriteEntity): CardRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    setupSessionId: row.setupSessionId,
    sourceMessageId: row.sourceMessageId,
    gateKey: row.gateKey,
    targetKey: row.targetKey,
    status: row.status,
    result: row.result,
    decidedBy: row.decidedBy,
    createdAt: row.createdAt.toISOString(),
    kind: FACT,
    payload: row.payload,
})

@Injectable()
/** The fact cards of the setup chat: the only owner of the module_setup_writes table. */
export class SetupWritesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The cards of the given sessions, oldest first; superseded cards are left out. */
    async ofSessions(sessionIds: ReadonlyArray<string>): Promise<ReadonlyArray<CardRecord>> {
        if (sessionIds.length === 0) return []
        const rows = await this.entityManager.find(ModuleSetupWriteEntity, {
            where: { setupSessionId: In([...sessionIds]), kind: FACT, status: Not("superseded") },
            order: { createdAt: "ASC", id: "ASC" },
            take: CARDS_LIMIT,
        })
        return rows.map((item) => toRecord(item))
    }

    /** One card of the workspace by id; null when there is none. */
    async find(workspaceId: string, cardId: string): Promise<OptionalCardRecord> {
        const row = await this.entityManager.findOne(ModuleSetupWriteEntity, {
            where: { id: cardId, workspaceId, kind: FACT },
        })
        return row === null ? null : toRecord(row)
    }

    /**
     * Stores the cards a turn proposed; a card replaces the waiting card of the same target. The waiting cards of the same owner message
     * (a turn attempted before) are replaced first, so a repeated turn never leaves two sets of cards.
     */
    async propose(
        workspaceId: string,
        sessionId: string,
        sourceMessageId: string,
        cards: ReadonlyArray<ProposedCardRecord>,
    ): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            await tx.update(
                ModuleSetupWriteEntity,
                { setupSessionId: sessionId, sourceMessageId, status: "proposed" },
                { status: "superseded" },
            )
            if (cards.length === 0) return
            await tx.update(
                ModuleSetupWriteEntity,
                { setupSessionId: sessionId, targetKey: In(cards.map((card) => card.target_key)), status: "proposed" },
                { status: "superseded" },
            )
            await tx.insert(
                ModuleSetupWriteEntity,
                cards.map((card) => ({
                    workspaceId,
                    setupSessionId: sessionId,
                    sourceMessageId,
                    gateKey: card.gate_key,
                    kind: card.kind,
                    targetKey: card.target_key,
                    payload: card.payload,
                })),
            )
        })
    }

    /** Closes a waiting card as applied or rejected; null when it was decided already. */
    async close(workspaceId: string, cardId: string, closing: CardClosing): Promise<OptionalCardRecord> {
        const closed = await this.entityManager.update(
            ModuleSetupWriteEntity,
            { id: cardId, workspaceId, kind: FACT, status: "proposed" },
            {
                status: closing.status,
                payload: closing.payload,
                result: closing.result,
                decidedBy: closing.decidedBy,
                decidedAt: () => "now()",
            },
        )
        if ((closed.affected ?? 0) === 0) return null
        const row = await this.entityManager.findOne(ModuleSetupWriteEntity, { where: { id: cardId, workspaceId } })
        return row === null ? null : toRecord(row)
    }
}
