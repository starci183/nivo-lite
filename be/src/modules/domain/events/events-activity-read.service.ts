import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EventsLeadActivity } from "./events-activity-read.contracts"
import { EventEntity } from "./persistence/entities"

@Injectable()
/** Request-time activity reads of the evidence log for dashboards and reports, always scoped to the workspace and bounded by the caller. */
export class EventsActivityReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The instant of the newest line about each of the given customers; customers without a line are missing. */
    lastAtByLead(
        workspaceId: string,
        leadIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<Array<EventsLeadActivity>> {
        if (leadIds.length === 0) return Promise.resolve([])
        return this.entityManager
            .createQueryBuilder(EventEntity, "e")
            .select("e.leadId", "lead_id")
            .addSelect("max(e.createdAt)", "last_at")
            .where("e.workspaceId = :workspaceId AND e.leadId IN (:...leadIds)", {
                workspaceId,
                leadIds: [...leadIds],
            })
            .groupBy("e.leadId")
            .limit(limit)
            .getRawMany<EventsLeadActivity>()
    }

    /** The customers the workspace logged a line of the kind about from an instant on. */
    async leadIdsOfKindSince(workspaceId: string, kind: string, since: Date, limit: number): Promise<Array<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(EventEntity, "e")
            .select("DISTINCT e.leadId", "lead_id")
            .where(
                "e.workspaceId = :workspaceId AND e.kind = :kind AND e.createdAt >= :since AND e.leadId IS NOT NULL",
                {
                    workspaceId,
                    kind,
                    since,
                },
            )
            .limit(limit)
            .getRawMany<{ lead_id: string }>()
        return rows.map((row) => row.lead_id)
    }
}
