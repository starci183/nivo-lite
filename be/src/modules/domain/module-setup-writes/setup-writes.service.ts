import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    BranchCardPayload,
    CardClosing,
    CardRecord,
    FactCardPayload,
    FactCardRecord,
    OptionalCardRecord,
    ProposedCardRecord,
    RuleCardPayload,
} from "./module-setup-writes.contracts"
import { ModuleSetupWriteEntity } from "./persistence/entities"

/** How many cards of the given sessions are read at once. */
const CARDS_LIMIT = 500

/** The stored fields of a card that are the same for a fact and for a rule. */
type CardBaseFields = Omit<FactCardRecord, "kind" | "payload">

/** Joins the common fields to the payload; the shape of the payload says whether the card is a branch, a rule or a fact. */
const cardOf = (base: CardBaseFields, payload: FactCardPayload | RuleCardPayload | BranchCardPayload): CardRecord => {
    if ("boundaryVnd" in payload) return { ...base, kind: "branch", payload }
    return "action" in payload ? { ...base, kind: "rule", payload } : { ...base, kind: "fact", payload }
}

/** Maps a stored card to its contract; the discriminated union follows the payload. */
const toRecord = (row: ModuleSetupWriteEntity): CardRecord =>
    cardOf(
        {
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
        },
        row.payload,
    )

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
        const closed = await this.entityManager.update(
            ModuleSetupWriteEntity,
            { id: cardId, workspaceId, status: "proposed" },
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
