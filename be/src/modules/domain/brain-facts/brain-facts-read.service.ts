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
