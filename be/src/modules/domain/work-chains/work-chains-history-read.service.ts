import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CompletedTask, StepThread } from "./work-chains-history-read.contracts"
import { WorkChainEntity } from "./persistence/entities"

/** The instant a completed step counts at: when it finished, else when it started. */
const TASK_AT = "COALESCE(c.finishedAt, c.startedAt)"

@Injectable()
/** Request-time reads of chain steps for the decision history of other capabilities, always scoped to the workspace and bounded by the caller. */
export class WorkChainsHistoryReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The thread of each given step of the workspace; a step that does not exist is missing. */
    async threadsOfSteps(workspaceId: string, stepIds: ReadonlyArray<string>): Promise<Array<StepThread>> {
        if (stepIds.length === 0) return []
        const rows = await this.entityManager.find(WorkChainEntity, {
            select: { id: true, threadId: true },
            where: { workspaceId, id: In([...stepIds]) },
            take: stepIds.length,
        })
        return rows.map((row) => ({ id: row.id, threadId: row.threadId }))
    }

    /** The hand-offs and assignments a member completed, newest first (ties by id, descending). */
    async completedTasks(workspaceId: string, skip: number, limit: number): Promise<Array<CompletedTask>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkChainEntity, "c")
            .where(
                "c.workspaceId = :workspaceId AND c.kind IN ('hand_off', 'assign') AND c.status = 'done' AND c.decidedBy IS NOT NULL",
                { workspaceId },
            )
            .orderBy(TASK_AT, "DESC")
            .addOrderBy("c.id", "DESC")
            .offset(skip)
            .limit(limit)
            .getMany()
        return rows.flatMap((row) =>
            row.decidedBy === null
                ? []
                : [
                      {
                          id: row.id,
                          threadId: row.threadId,
                          actorKind: row.actorKind,
                          actorId: row.actorId,
                          action: row.action,
                          rule: row.rule,
                          decidedBy: row.decidedBy,
                          at: row.finishedAt ?? row.startedAt,
                      },
                  ],
        )
    }
}
