import { Injectable } from "@nestjs/common"
import { Between, In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ApiEvent, LeadFirstEvent } from "./events-read.contracts"
import { EventEntity } from "./persistence/entities"

/** The evidence clipped by the select, in characters. */
const EVIDENCE_CLIP = 500

/** One row of the public listing as the select shapes it. */
interface ApiEventRow {
    readonly id: string
    readonly kind: string
    readonly actor: string
    readonly summary: string
    readonly evidence: string | null
    readonly lead_id: string | null
    readonly created_at: string
}

@Injectable()
/** Request-time evidence-log reads for other capabilities (dashboards, the public API), always scoped to the workspace. */
export class EventsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Whether the workspace logged a line of the kind from the first instant to the second (both included). */
    existsOfKindBetween(workspaceId: string, kind: string, from: Date, to: Date): Promise<boolean> {
        return this.entityManager.exists(EventEntity, { where: { workspaceId, kind, createdAt: Between(from, to) } })
    }

    /** Whether the workspace logged a line of the kind about any of the given customers. */
    existsOfKindForLeads(workspaceId: string, kind: string, leadIds: ReadonlyArray<string>): Promise<boolean> {
        if (leadIds.length === 0) return Promise.resolve(false)
        return this.entityManager.exists(EventEntity, { where: { workspaceId, kind, leadId: In([...leadIds]) } })
    }

    /** When each of the given customers first reached one of the kinds; customers that never did are missing. */
    async firstAtByLead(
        workspaceId: string,
        kinds: ReadonlyArray<string>,
        leadIds: ReadonlyArray<string>,
    ): Promise<Array<LeadFirstEvent>> {
        if (leadIds.length === 0 || kinds.length === 0) return []
        return this.entityManager
            .createQueryBuilder(EventEntity, "e")
            .select("e.leadId", "leadId")
            .addSelect("min(e.createdAt)", "at")
            .where("e.workspaceId = :workspaceId AND e.kind IN (:...kinds) AND e.leadId IN (:...leadIds)", {
                workspaceId,
                kinds: [...kinds],
                leadIds: [...leadIds],
            })
            .groupBy("e.leadId")
            .getRawMany<LeadFirstEvent>()
    }

    /** When the customer first reached the kind; null when never. */
    async firstAtOfKind(workspaceId: string, leadId: string, kind: string): Promise<Date | null> {
        const event = await this.entityManager.findOne(EventEntity, {
            select: { createdAt: true },
            where: { workspaceId, leadId, kind },
            order: { createdAt: "ASC" },
        })
        return event?.createdAt ?? null
    }

    /** The lines of the workspace logged after an instant, oldest first, bounded by the caller. */
    async listAfter(workspaceId: string, since: string, limit: number): Promise<Array<ApiEvent>> {
        const rows = await this.entityManager
            .createQueryBuilder(EventEntity, "e")
            .select("e.id", "id")
            .addSelect("e.kind", "kind")
            .addSelect("e.actor", "actor")
            .addSelect("e.summary", "summary")
            .addSelect(`left(e.evidence, ${String(EVIDENCE_CLIP)})`, "evidence")
            .addSelect("e.leadId", "lead_id")
            .addSelect("to_char(e.createdAt AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')", "created_at")
            .where("e.workspaceId = :workspaceId AND e.createdAt > :since", { workspaceId, since })
            .orderBy("e.createdAt", "ASC")
            .limit(limit)
            .getRawMany<ApiEventRow>()
        return rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            actor: row.actor,
            summary: row.summary,
            evidence: row.evidence,
            leadId: row.lead_id,
            createdAt: row.created_at,
        }))
    }
}
