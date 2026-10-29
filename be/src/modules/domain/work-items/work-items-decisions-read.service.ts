import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { WaitingDecision } from "./work-items-decisions-read.contracts"
import { WorkItemEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of the work items a department asks the owner to decide, always scoped to the workspace and bounded by the caller. */
export class WorkItemsDecisionsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The work items of the department waiting for a decision, oldest first, at most `limit`. */
    waiting(workspaceId: string, department: string, limit: number): Promise<Array<WaitingDecision>> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.action", "action")
            .addSelect("w.proposal", "proposal")
            .addSelect("w.created_at", "created_at")
            .where("w.workspace_id = :workspaceId AND w.department = :department AND w.status = 'waiting_decision'", {
                workspaceId,
                department,
            })
            .orderBy("w.created_at")
            .limit(limit)
            .getRawMany<WaitingDecision>()
    }

    /** How many work items of the workspace carry a dedupe key that starts with `prefix`. */
    async countWithKeyPrefix(workspaceId: string, prefix: string): Promise<number> {
        const counted = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("CAST(COUNT(*) AS int)", "attempts")
            .where("w.workspace_id = :workspaceId AND w.dedupe_key LIKE :pattern", {
                workspaceId,
                pattern: `${prefix}%`,
            })
            .getRawOne<{ attempts: number }>()
        return counted?.attempts ?? 0
    }
}
