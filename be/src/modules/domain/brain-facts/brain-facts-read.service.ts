import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    FactAudience,
    FactFilter,
    FactRecord,
    FactStatus,
    InstallationScope,
    MaybeFact,
} from "./brain-facts.contracts"
import { factKeyOf } from "./fact-columns.policy"
import { toFactRecord } from "./fact-record.mapper"
import { inForce, searchFacts, visibleTo } from "./fact-view.policy"
import { BrainFactEntity } from "./persistence/entities"

/** The most facts a list returns. */
const LIST_MAX = 2000

@Injectable()
/** The read side of the facts: one fact, a list, the facts of a key, and what one agent may use or find right now. */
export class BrainFactsReadService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** One fact of the workspace. */
    get(workspaceId: string, id: string): Promise<MaybeFact> {
        return this.fetch(this.entityManager, workspaceId, id)
    }

    /** The facts of the workspace, newest change first. */
    async list(workspaceId: string, filter: FactFilter): Promise<ReadonlyArray<FactRecord>> {
        const rows = await this.entityManager.find(BrainFactEntity, {
            where: {
                workspaceId,
                ...(filter.statuses === undefined ? {} : { status: In(filter.statuses) }),
                ...(filter.subjectKey === undefined ? {} : { subjectKey: filter.subjectKey }),
            },
            order: { updatedAt: "DESC" },
            take: Math.min(filter.limit ?? 500, LIST_MAX),
        })
        return rows.map(toFactRecord)
    }

    /** The facts of a key in one status and scope. */
    byKey(
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        status: FactStatus,
        installationId: InstallationScope,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.keyed(this.entityManager, workspaceId, subjectKey, attribute, status, installationId)
    }

    /** The active facts one agent may use right now: in force and inside its view. */
    async forView(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        const at = this.clock.now().getTime()
        const active = await this.list(workspaceId, { statuses: ["active"], limit })
        return active.filter((fact) => inForce(fact, at) && visibleTo(fact, audience, module, installationId))
    }

    /** The facts of a view that match a question, best first. */
    async search(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        query: string,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        return searchFacts(await this.forView(workspaceId, audience, module, installationId, 500), query, limit)
    }

    /** The facts in these statuses whose evidence cites any of these documents, newest change first, in one bounded read. */
    async ofSources(
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
        statuses: ReadonlyArray<FactStatus>,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        if (sourceIds.length === 0 || statuses.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where(
                "f.workspaceId = :workspaceId AND f.status IN (:...statuses) AND EXISTS (SELECT 1 FROM jsonb_array_elements(f.evidence) AS e WHERE e->>'kind' = 'document' AND e->>'ref' = ANY(:sourceIds))",
                { workspaceId, statuses: [...statuses], sourceIds: [...sourceIds] },
            )
            .orderBy("f.updatedAt", "DESC")
            .limit(Math.min(limit, LIST_MAX))
            .getMany()
        return rows.map(toFactRecord)
    }

    /** One fact through a manager. */
    async fetch(em: EntityManager, workspaceId: string, id: string): Promise<MaybeFact> {
        const row = await em.findOne(BrainFactEntity, { where: { workspaceId, id } })
        return row === null ? null : toFactRecord(row)
    }

    /** The facts of a key in one status and scope through a manager. */
    async keyed(
        em: EntityManager,
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        status: FactStatus,
        installationId: InstallationScope,
    ): Promise<ReadonlyArray<FactRecord>> {
        const rows = await em.find(BrainFactEntity, {
            where: { ...factKeyOf(workspaceId, subjectKey, attribute, installationId), status },
            order: { proposedAt: "DESC" },
            take: 50,
        })
        return rows.map(toFactRecord)
    }
}
