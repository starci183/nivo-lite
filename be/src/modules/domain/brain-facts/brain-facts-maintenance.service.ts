import { Injectable } from "@nestjs/common"
import { Raw, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainFactsReadService } from "./brain-facts-read.service"
import type { FactRecord, MaintenanceResult, WithdrawnFacts } from "./brain-facts.contracts"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { RETURNED, returnedFacts } from "./fact-columns.policy"
import { NOTHING_STANDS, evidenceAfterChange, type UnchangedPassages } from "./fact-evidence.policy"
import { toFactRecord } from "./fact-record.mapper"
import { DEFAULT_VALID_TO, SUPERSEDE, decisionOf, nextVersion } from "./fact-write.policy"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactEntity } from "./persistence/entities"

/** Who acts for the brain itself when no person decides. */
const BRAIN = "NIVO"

@Injectable()
/** The upkeep of the facts: scheduled facts take over, ended facts expire, and a withdrawn source leaves its evidence. */
export class BrainFactsMaintenanceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly reads: BrainFactsReadService,
        private readonly relations: BrainFactRelationsService,
    ) {}

    /**
     * Takes one document's contribution back: proposals that rest on it alone are rejected with `note`; a proposal or fact that other
     * sources also support only loses this document from its evidence. Answers the ids of active document facts left with no evidence.
     */
    async withdrawSource(workspaceId: string, sourceId: string, note: string): Promise<ReadonlyArray<string>> {
        return (await this.withdrawChanged(workspaceId, sourceId, note, NOTHING_STANDS)).orphans
    }

    /**
     * Takes back what a changed document no longer says, chunk by chunk: a piece of evidence read from a passage whose hash is among the
     * unchanged ones stays (older evidence without a hash: when its quote is in the unchanged text), and a fact none of whose pieces
     * changed is not touched at all. Only the facts born from changed chunks lose evidence, are rejected (a proposal left with none) or
     * become orphans (an active document fact left with none).
     */
    async withdrawChanged(
        workspaceId: string,
        sourceId: string,
        note: string,
        unchanged: UnchangedPassages,
    ): Promise<WithdrawnFacts> {
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
        const taken = rows
            .map((item) => toFactRecord(item))
            .map((fact) => ({ fact, after: evidenceAfterChange(fact, sourceId, unchanged) }))
            .filter(({ after }) => after.touched)
        await eachInOrder(taken, async ({ fact, after }) => {
            const { rest } = after
            if (fact.status === "proposed" && rest.length === 0) {
                await this.reject(workspaceId, fact.id, note)
                return
            }
            await this.entityManager
                .createQueryBuilder(BrainFactEntity, "bf")
                .update()
                .set({ evidence: () => ":evidence::jsonb" })
                .where({ workspaceId, id: fact.id })
                .setParameter("evidence", JSON.stringify(rest))
                .execute()
            if (fact.status === "active" && rest.length === 0 && fact.sourceKind === "document") orphans.push(fact.id)
        })
        return { orphans, withdrawn: taken.length }
    }

    /** Scheduled facts whose time has come take over and ended facts expire. */
    async maintain(workspaceId: string): Promise<MaintenanceResult> {
        const due = (
            await this.entityManager.find(BrainFactEntity, {
                where: { workspaceId, status: "scheduled", validFrom: Raw((column) => `${column} <= now()`) },
                take: 200,
            })
        ).map((item) => toFactRecord(item))
        const activated: Array<FactRecord> = []
        await eachInOrder(due, async (fact) => {
            const current = await this.replacedBy(workspaceId, fact)
            await eachInOrder(current, (old) =>
                this.entityManager.update(BrainFactEntity, { workspaceId, id: old.id, status: "active" }, SUPERSEDE),
            )
            const promoted = await this.entityManager
                .createQueryBuilder(BrainFactEntity, "bf")
                .update()
                .set({ status: "active", version: nextVersion(current[0]), validTo: () => DEFAULT_VALID_TO })
                .where({ workspaceId, id: fact.id, status: "scheduled" })
                .returning(RETURNED)
                .execute()
            const [row] = returnedFacts(promoted.raw)
            if (row === undefined) return
            activated.push(toFactRecord(row))
            await eachInOrder(current, (old) => this.relations.carry(this.entityManager, workspaceId, old.id, fact.id))
        })
        const expired = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({ status: "expired" })
            .where({ workspaceId, status: "active", validTo: Raw((column) => `${column} < now()`) })
            .returning("id")
            .execute()
        return { activated, expired: Array.isArray(expired.raw) ? expired.raw.length : 0 }
    }

    /**
     * The values in force a scheduled fact takes over from when its start comes: the fact its approval named as the one it replaces
     * (`supersedesId`: the value in force of its key, or the fact of another key a confirmed same-meaning proposal merges over), while it
     * is still active, then every other active value of its own key and scope. So the replaced value ends exactly when the new one
     * starts (its end was set to that start on approval) and is closed as history with its relations carried, never left in force.
     */
    private async replacedBy(workspaceId: string, fact: FactRecord): Promise<ReadonlyArray<FactRecord>> {
        const keyed = await this.reads.keyed(
            this.entityManager,
            workspaceId,
            fact.subjectKey,
            fact.attribute,
            "active",
            fact.installationId,
        )
        const namedId = fact.supersedesId
        if (namedId === null || keyed.some((one) => one.id === namedId)) return keyed
        const named = await this.reads.fetch(this.entityManager, workspaceId, namedId)
        return named?.status === "active" ? [named, ...keyed] : keyed
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
