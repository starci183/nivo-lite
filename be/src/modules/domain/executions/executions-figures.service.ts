import { Injectable } from "@nestjs/common"
import { In, IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { PendingExecution } from "./executions-figures.contracts"
import { ExecutionEntity } from "./persistence/entities"

@Injectable()
/** The dashboard counts and lists of a workspace's executions, always scoped to the workspace. */
export class ExecutionsFiguresService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How many executions of the workspace were approved. */
    countApproved(workspaceId: string): Promise<number> {
        return this.entityManager.count(ExecutionEntity, { where: { workspaceId, status: "approved" } })
    }

    /** How many drafts wait for a decision without a work item behind them. */
    countPendingWithoutWork(workspaceId: string): Promise<number> {
        return this.entityManager.count(ExecutionEntity, {
            where: { workspaceId, status: "pending_approval", workItemId: IsNull() },
        })
    }

    /** The drafts waiting for a decision, newest first, bounded by the caller. */
    async pendingOf(workspaceId: string, limit: number): Promise<Array<PendingExecution>> {
        const drafts = await this.entityManager.find(ExecutionEntity, {
            select: { id: true, responsibilityId: true, createdAt: true },
            where: { workspaceId, status: "pending_approval" },
            order: { createdAt: "DESC" },
            take: limit,
        })
        return drafts.map((draft) => ({
            id: draft.id,
            responsibilityId: draft.responsibilityId,
            createdAt: draft.createdAt,
        }))
    }

    /** Whether any of the given steps has an approved execution. */
    hasApprovedAmong(workspaceId: string, responsibilityIds: ReadonlyArray<string>): Promise<boolean> {
        if (responsibilityIds.length === 0) return Promise.resolve(false)
        return this.entityManager.exists(ExecutionEntity, {
            where: { workspaceId, status: "approved", responsibilityId: In([...responsibilityIds]) },
        })
    }
}
