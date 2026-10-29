import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type {
    ExecutionCard,
    ExecutionListFilter,
    ExecutionRecord,
    ExecutionSettlement,
    NewExecution,
    OptionalExecution,
    OptionalExecutionRecord,
} from "./executions.contracts"
import { ExecutionsError, ExecutionsErrorCode } from "./errors/executions.error"
import { ExecutionEntity } from "./persistence/entities"

/** The columns a settled card answers. */
const CARD_COLUMNS = "id, status, work_item_id, draft"

/** Maps a stored card to the decision-flow contract. */
const toCard = (entity: ExecutionEntity): ExecutionCard => ({
    id: entity.id,
    status: entity.status,
    work_item_id: entity.workItemId,
    draft: entity.draft,
})

/** Selects the complete card with the decision and creation times as the ISO text the contract always carried. */
const recordQuery = (manager: EntityManager, workspaceId: string): SelectQueryBuilder<ExecutionEntity> =>
    manager
        .createQueryBuilder(ExecutionEntity, "x")
        .select("x.id", "id")
        .addSelect("x.workspaceId", "workspace_id")
        .addSelect("x.responsibilityId", "responsibility_id")
        .addSelect("x.agentId", "agent_id")
        .addSelect("x.kind", "kind")
        .addSelect("x.draft", "draft")
        .addSelect("x.status", "status")
        .addSelect("x.decidedBy", "decided_by")
        .addSelect("to_json(x.decided_at) #>> '{}'", "decided_at")
        .addSelect("x.workItemId", "work_item_id")
        .addSelect("to_json(x.created_at) #>> '{}'", "created_at")
        .where("x.workspaceId = :workspaceId", { workspaceId })

@Injectable()
/** The approval cards of drafts: the only writer of public.executions. */
export class ExecutionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Creates the approval card of a draft and answers its id. */
    async open(card: NewExecution): Promise<string> {
        const inserted = await this.entityManager.insert(ExecutionEntity, {
            workspaceId: card.workspaceId,
            responsibilityId: card.responsibilityId,
            agentId: card.agentId,
            draft: card.draft,
            workItemId: card.workItemId,
        })
        const id: unknown = inserted.identifiers[0]?.id
        if (typeof id !== "string") throw new ExecutionsError({ code: ExecutionsErrorCode.NotCreated })
        return id
    }

    /** The approval card of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, executionId: string): Promise<OptionalExecution> {
        const entity = await this.entityManager.findOne(ExecutionEntity, {
            select: { id: true, status: true, workItemId: true, draft: true },
            where: { workspaceId, id: executionId },
        })
        return entity === null ? null : toCard(entity)
    }

    /** Reads the complete card through the row owner, inside the caller's transaction when supplied. */
    async findRecord(
        workspaceId: string,
        executionId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalExecutionRecord> {
        const record = await recordQuery(manager, workspaceId)
            .andWhere("x.id = :executionId", { executionId })
            .limit(1)
            .getRawOne<ExecutionRecord>()
        return record ?? null
    }

    /** Lists the workspace's approval cards, oldest first, with a caller-provided row limit. */
    list(workspaceId: string, filter: ExecutionListFilter): Promise<Array<ExecutionRecord>> {
        const query = recordQuery(this.entityManager, workspaceId)
        if (filter.responsibilityIds !== undefined) {
            query.andWhere("x.responsibilityId = ANY(:responsibilityIds)", {
                responsibilityIds: [...filter.responsibilityIds],
            })
        }
        if (filter.pendingLegacy === true) query.andWhere("x.status = 'pending_approval' AND x.workItemId IS NULL")
        return query
            .orderBy("x.createdAt", "ASC")
            .addOrderBy("x.id", "ASC")
            .limit(filter.limit)
            .getRawMany<ExecutionRecord>()
    }

    /** Settles a card that still waits; answers null when somebody decided it first, so a double click settles once. */
    async settle(
        settlement: ExecutionSettlement,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalExecution> {
        const result = await manager
            .createQueryBuilder(ExecutionEntity, "e")
            .update()
            .set({
                status: settlement.decision,
                decidedBy: settlement.decidedBy,
                decidedAt: this.clock.now(),
                ...(settlement.editedDraft === null ? {} : { draft: settlement.editedDraft }),
            })
            .where("workspace_id = :workspaceId AND id = :executionId AND status = 'pending_approval'", {
                workspaceId: settlement.workspaceId,
                executionId: settlement.executionId,
            })
            .returning(CARD_COLUMNS)
            .execute()
        const rows = result.raw as Array<ExecutionCard>
        return rows[0] ?? null
    }
}
