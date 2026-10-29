import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EventEntry, EventLine, EventListFilter, EventRecord } from "./events.contracts"
import { EventEntity } from "./persistence/entities"

@Injectable()
/** The append-only evidence log: the only writer of public.events. */
export class EventsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Appends one line to the workspace's evidence log, inside the caller's transaction when it hands one. */
    async record(entry: EventEntry, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.insert(EventEntity, {
            workspaceId: entry.workspaceId,
            kind: entry.kind,
            actor: entry.actor,
            summary: entry.summary,
            leadId: entry.leadId ?? null,
            workItemId: entry.workItemId ?? null,
            evidence: entry.evidence ?? null,
        })
    }

    /** The first lines of a customer's history, oldest first. */
    async leadHistory(workspaceId: string, leadId: string, limit: number): Promise<Array<EventLine>> {
        const rows = await this.entityManager.find(EventEntity, {
            select: { summary: true, evidence: true },
            where: { workspaceId, leadId },
            order: { createdAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ summary: row.summary, evidence: row.evidence }))
    }

    /** Lists the workspace's evidence history with caller-provided filters and a row limit; the time is selected as the ISO text the log always answered. */
    list(workspaceId: string, filter: EventListFilter): Promise<Array<EventRecord>> {
        const query = this.entityManager
            .createQueryBuilder(EventEntity, "e")
            .select("e.id", "id")
            .addSelect("e.leadId", "lead_id")
            .addSelect("e.kind", "kind")
            .addSelect("e.actor", "actor")
            .addSelect("e.summary", "summary")
            .addSelect("e.evidence", "evidence")
            .addSelect("to_json(e.created_at) #>> '{}'", "created_at")
            .addSelect("e.workItemId", "work_item_id")
            .where("e.workspaceId = :workspaceId", { workspaceId })
        if (filter.leadId !== undefined) query.andWhere("e.leadId = :leadId", { leadId: filter.leadId })
        if (filter.kind !== undefined) query.andWhere("e.kind = :kind", { kind: filter.kind })
        if (filter.workItemIds !== undefined) {
            query.andWhere("e.workItemId = ANY(:workItemIds)", { workItemIds: [...filter.workItemIds] })
        }
        return query
            .orderBy("e.createdAt", filter.oldestFirst ? "ASC" : "DESC")
            .addOrderBy("e.id", "ASC")
            .limit(filter.limit)
            .getRawMany<EventRecord>()
    }
}
