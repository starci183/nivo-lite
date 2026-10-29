import { Injectable } from "@nestjs/common"
import { Raw } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainFactsReadService } from "./brain-facts-read.service"
import type { FactRecord, MaintenanceResult } from "./brain-facts.contracts"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { RETURNED, returnedFacts } from "./fact-columns.policy"
import { toFactRecord } from "./fact-record.mapper"
import { SUPERSEDE, decisionOf } from "./fact-write.policy"
import { BrainFactEntity } from "./persistence/entities"

/** Who acts for the brain itself when no person decides. */
const BRAIN = "NIVO"

@Injectable()
/** The upkeep of the facts: scheduled facts take over, ended facts expire, and a withdrawn source leaves its evidence. */
export class BrainFactsMaintenanceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly reads: BrainFactsReadService,
    ) {}

    /**
     * Takes one document's contribution back: proposals that rest on it alone are rejected with `note`; a proposal or fact that other
     * sources also support only loses this document from its evidence. Answers the ids of active document facts left with no evidence.
     */
    async withdrawSource(workspaceId: string, sourceId: string, note: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "f")
            .where(
                "f.workspaceId = :workspaceId AND f.status IN ('proposed', 'scheduled', 'active') AND f.evidence @> :pattern::jsonb",
                {
                    workspaceId,
                    pattern: JSON.stringify([{ kind: "document", ref: sourceId }]),
                },
            )
            .limit(2000)
            .getMany()
        const orphans: Array<string> = []
        await eachInOrder(rows.map(toFactRecord), async (fact) => {
            const rest = fact.evidence.filter((item) => !(item.kind === "document" && item.ref === sourceId))
            if (fact.status === "proposed" && rest.length === 0) {
                await this.reject(workspaceId, fact.id, note)
                return
            }
            await this.entityManager
                .createQueryBuilder(BrainFactEntity, "bf")
                .update()
                .set({ evidence: () => ":evidence::jsonb", updatedAt: () => "now()" })
                .where({ workspaceId, id: fact.id })
                .setParameter("evidence", JSON.stringify(rest))
                .execute()
            if (fact.status === "active" && rest.length === 0 && fact.sourceKind === "document") orphans.push(fact.id)
        })
        return orphans
    }

    /** Scheduled facts whose time has come take over and ended facts expire. */
    async maintain(workspaceId: string): Promise<MaintenanceResult> {
        const due = (
            await this.entityManager.find(BrainFactEntity, {
                where: { workspaceId, status: "scheduled", validFrom: Raw((column) => `${column} <= now()`) },
                take: 200,
            })
        ).map(toFactRecord)
        const activated: Array<FactRecord> = []
        await eachInOrder(due, async (fact) => {
            const current = await this.reads.keyed(
                this.entityManager,
                workspaceId,
                fact.subjectKey,
                fact.attribute,
                "active",
                fact.installationId,
            )
            await eachInOrder(current, (old) =>
                this.entityManager.update(BrainFactEntity, { workspaceId, id: old.id, status: "active" }, SUPERSEDE),
            )
            const promoted = await this.entityManager
                .createQueryBuilder(BrainFactEntity, "bf")
                .update()
                .set({ status: "active", updatedAt: () => "now()" })
                .where({ workspaceId, id: fact.id, status: "scheduled" })
                .returning(RETURNED)
                .execute()
            const [row] = returnedFacts(promoted.raw)
            if (row !== undefined) activated.push(toFactRecord(row))
        })
        const expired = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({ status: "expired", updatedAt: () => "now()" })
            .where({ workspaceId, status: "active", validTo: Raw((column) => `${column} < now()`) })
            .returning("id")
            .execute()
        return { activated, expired: Array.isArray(expired.raw) ? expired.raw.length : 0 }
    }

    /** Turns a waiting proposal down in one atomic statement; refuses when it is no longer waiting. */
    private async reject(workspaceId: string, id: string, note: string): Promise<void> {
        const updated = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set(decisionOf("rejected", note.trim() || null, BRAIN))
            .where({ workspaceId, id, status: "proposed" })
            .returning(RETURNED)
            .execute()
        if (returnedFacts(updated.raw).length === 0)
            throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
    }
}
