import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalWorkItemWithCursor, WorkItemsPageQuery, WorkItemWithCursor } from "./work-items-views-read.contracts"
import type { WorkItem } from "./work-items.contracts"
import { toWorkItem, toWorkItemRecord } from "./work-items.mapper"
import { WorkItemEntity } from "./persistence/entities"

/** The creation instant as ISO text at full precision, which a millisecond date cannot carry. */
const CURSOR_AT = "to_json(w.createdAt) #>> '{}'"

@Injectable()
/** Request-time reads of work items for the Decisions views of other capabilities, always scoped to the workspace and bounded by the caller. */
export class WorkItemsViewsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** One work item of the workspace with its cursor; null when there is none. */
    async find(workspaceId: string, workItemId: string): Promise<OptionalWorkItemWithCursor> {
        const [found] = await this.withCursors(
            this.entityManager
                .createQueryBuilder(WorkItemEntity, "w")
                .where("w.workspaceId = :workspaceId AND w.id = :workItemId", { workspaceId, workItemId })
                .limit(1),
        )
        return found ?? null
    }

    /** One page of the workspace's work items, newest first, keyset on (created at, id). */
    listPage(workspaceId: string, query: WorkItemsPageQuery): Promise<Array<WorkItemWithCursor>> {
        const select = this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .where("w.workspaceId = :workspaceId", { workspaceId })
        if (query.statuses.length > 0) select.andWhere("w.status IN (:...statuses)", { statuses: [...query.statuses] })
        if (query.after !== null) {
            select.andWhere("(w.createdAt, w.id) < (CAST(:afterCreatedAt AS timestamptz), CAST(:afterId AS uuid))", {
                afterCreatedAt: query.after.createdAt,
                afterId: query.after.id,
            })
        }
        if (query.action !== null) select.andWhere("w.action = :action", { action: query.action })
        return this.withCursors(select.orderBy("w.createdAt", "DESC").addOrderBy("w.id", "DESC").limit(query.limit))
    }

    /** The accounting work waiting for a decision, oldest first, at most `limit`. */
    async waitingAccounting(workspaceId: string, limit: number): Promise<Array<WorkItem>> {
        const rows = await this.entityManager.find(WorkItemEntity, {
            where: { workspaceId, department: "accounting", status: "waiting_decision" },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => toWorkItem(toWorkItemRecord(row)))
    }

    /** Runs the select and pairs each item with its cursor, which a second read of the same rows gives at full precision. */
    private async withCursors(select: SelectQueryBuilder<WorkItemEntity>): Promise<Array<WorkItemWithCursor>> {
        const entities = await select.getMany()
        if (entities.length === 0) return []
        const stamps = await this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect(CURSOR_AT, "cursor_at")
            .where("w.id IN (:...ids)", { ids: entities.map((entity) => entity.id) })
            .getRawMany<{ id: string; cursor_at: string }>()
        const cursors = new Map(stamps.map((stamp) => [stamp.id, stamp.cursor_at]))
        return entities.map((entity) => ({
            item: toWorkItem(toWorkItemRecord(entity)),
            cursorAt: cursors.get(entity.id) ?? entity.createdAt.toISOString(),
        }))
    }
}
