import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CardClosing, CardRecord, OptionalCardRecord, ProposedCardRecord } from "./module-setup-writes.contracts"
import { ModuleSetupWriteEntity } from "./persistence/entities"

/** How many cards of the given sessions are read at once. */
const CARDS_LIMIT = 500

/** The columns the closing update answers. */
interface ClosedRow {
    /** The card. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The session it belongs to. */
    readonly setup_session_id: string
    /** The owner message it came from. */
    readonly source_message_id: string | null
    /** The gate it answers. */
    readonly gate_key: string
    /** Fact or rule. */
    readonly kind: ModuleSetupWriteEntity["kind"]
    /** The target key. */
    readonly target_key: string
    /** The payload as decided. */
    readonly payload: ModuleSetupWriteEntity["payload"]
    /** Where it stands. */
    readonly status: ModuleSetupWriteEntity["status"]
    /** What it did. */
    readonly result: ModuleSetupWriteEntity["result"]
    /** Who decided it. */
    readonly decided_by: string | null
    /** When it was proposed. */
    readonly created_at: Date
}

/** Maps a stored card to its contract; the discriminated union follows `kind`. */
const toRecord = (row: ModuleSetupWriteEntity): CardRecord =>
    ({
        id: row.id,
        workspaceId: row.workspaceId,
        setupSessionId: row.setupSessionId,
        sourceMessageId: row.sourceMessageId,
        gateKey: row.gateKey,
        kind: row.kind,
        targetKey: row.targetKey,
        payload: row.payload,
        status: row.status,
        result: row.result,
        decidedBy: row.decidedBy,
        createdAt: row.createdAt.toISOString(),
    }) as CardRecord

/** Maps a row the closing update answered to its contract. */
const toClosedRecord = (row: ClosedRow): CardRecord =>
    ({
        id: row.id,
        workspaceId: row.workspace_id,
        setupSessionId: row.setup_session_id,
        sourceMessageId: row.source_message_id,
        gateKey: row.gate_key,
        kind: row.kind,
        targetKey: row.target_key,
        payload: row.payload,
        status: row.status,
        result: row.result,
        decidedBy: row.decided_by,
        createdAt: row.created_at.toISOString(),
    }) as CardRecord

@Injectable()
/** The confirm cards of the setup chat: the only owner of the module_setup_writes table. */
export class SetupWritesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The cards of the given sessions, oldest first; superseded cards are left out. */
    async ofSessions(sessionIds: ReadonlyArray<string>): Promise<ReadonlyArray<CardRecord>> {
        if (sessionIds.length === 0) return []
        const rows = await this.entityManager.find(ModuleSetupWriteEntity, {
            where: { setupSessionId: In([...sessionIds]), status: Not("superseded") },
            order: { createdAt: "ASC", id: "ASC" },
            take: CARDS_LIMIT,
        })
        return rows.map(toRecord)
    }

    /** One card of the workspace by id; null when there is none. */
    async find(workspaceId: string, cardId: string): Promise<OptionalCardRecord> {
        const row = await this.entityManager.findOne(ModuleSetupWriteEntity, { where: { id: cardId, workspaceId } })
        return row === null ? null : toRecord(row)
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
        const closed = await this.entityManager
            .createQueryBuilder(ModuleSetupWriteEntity, "m")
            .update()
            .set({
                status: closing.status,
                payload: closing.payload,
                result: closing.result,
                decidedBy: closing.decidedBy,
                decidedAt: () => "now()",
            })
            .where({ id: cardId, workspaceId, status: "proposed" })
            .returning("*")
            .execute()
        const [row] = closed.raw as Array<ClosedRow>
        return row === undefined ? null : toClosedRecord(row)
    }
}
