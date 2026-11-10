import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { FactRelation, FactStatus, RelationInput } from "./brain-facts.contracts"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { RELATION_READ_MAX, carriedRelationsOf, checkRelation, toFactRelation } from "./fact-relation.policy"
import type { CheckedRelation } from "./fact-relation.policy"
import { BrainFactEntity, BrainFactRelationEntity } from "./persistence/entities"

@Injectable()
/**
 * The edges of the truth graph. Every read and write names the workspace (the table's row security and its composite keys to
 * `brain_facts` hold the same line): an edge joins two facts of one workspace, never one fact to itself, and one edge of a kind joins
 * a pair once. When a value is replaced, its edges are carried to the new value; the old value keeps its own as history.
 */
export class BrainFactRelationsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Joins two facts of the workspace; the same edge again answers the one already stored. */
    async link(workspaceId: string, input: RelationInput): Promise<FactRelation> {
        const checked = checkRelation(input)
        if (!checked.ok) throw new BrainFactsError({ code: BrainFactsErrorCode.RelationInvalid })
        const { relation } = checked
        const known = await this.knownOf(workspaceId, [relation.fromFactId, relation.toFactId])
        if (known.size !== 2) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
        await this.insert(this.entityManager, workspaceId, [relation])
        const stored = await this.entityManager.findOne(BrainFactRelationEntity, {
            where: {
                workspaceId,
                fromFactId: relation.fromFactId,
                toFactId: relation.toFactId,
                kind: relation.kind,
            },
        })
        if (stored === null) throw new BrainFactsError({ code: BrainFactsErrorCode.RelationNotFound })
        return toFactRelation(stored)
    }

    /**
     * Joins many pairs at once for the reading of one document, as edges the model PROPOSES: an edge that does not hold (unknown kind, a
     * fact to itself, a fact of another workspace) is left out, an edge already stored is kept, and an edge between two facts that are
     * BOTH already in force is left out too. So every edge of a reading touches at least one waiting proposal and stands (is served by
     * `nivo.brain.fact.related`, which reads only facts in force at both ends) only once the founder has put that proposal in force; nothing
     * the model links ever stands without a person. Answers how many edges were asked for after the check.
     */
    async linkMany(workspaceId: string, inputs: ReadonlyArray<RelationInput>): Promise<number> {
        const checked = inputs.flatMap((input) => {
            const result = checkRelation(input)
            return result.ok ? [result.relation] : []
        })
        if (checked.length === 0) return 0
        const known = await this.knownOf(
            workspaceId,
            checked.flatMap((relation) => [relation.fromFactId, relation.toFactId]),
        )
        const rows = checked.filter(
            (relation) =>
                known.has(relation.fromFactId) &&
                known.has(relation.toFactId) &&
                (known.get(relation.fromFactId) !== "active" || known.get(relation.toFactId) !== "active"),
        )
        if (rows.length === 0) return 0
        await this.insert(this.entityManager, workspaceId, rows)
        return rows.length
    }

    /** Removes one edge of the workspace; answers whether it was there. */
    async unlink(workspaceId: string, id: string): Promise<boolean> {
        const removed = await this.entityManager.delete(BrainFactRelationEntity, { workspaceId, id })
        return (removed.affected ?? 0) > 0
    }

    /** The edges that touch any of these facts, either way, oldest first; one bounded read per direction on its own index. */
    ofFacts(workspaceId: string, factIds: ReadonlyArray<string>): Promise<ReadonlyArray<FactRelation>> {
        return this.edgesOf(this.entityManager, workspaceId, factIds)
    }

    /**
     * Carries the edges of a replaced value to the value that replaces it, in the transaction of the replacement: each edge of the old
     * fact is copied with the new fact in its place (an edge between the two values themselves is not). The old edges stay as history.
     */
    async carry(em: EntityManager, workspaceId: string, oldId: string, newId: string): Promise<void> {
        const carried = carriedRelationsOf(await this.edgesOf(em, workspaceId, [oldId]), oldId, newId)
        if (carried.length > 0) await this.insert(em, workspaceId, carried)
    }

    /** The ids among these that are facts of the workspace, each with its status. */
    private async knownOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, FactStatus>> {
        const unique = [...new Set(ids)]
        const rows = await this.entityManager.find(BrainFactEntity, {
            select: { id: true, status: true },
            where: { workspaceId, id: In(unique) },
            take: unique.length,
        })
        return new Map(rows.map((row) => [row.id, row.status]))
    }

    /** The edges touching these facts through a manager, both directions, each once. */
    private async edgesOf(
        em: EntityManager,
        workspaceId: string,
        factIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<FactRelation>> {
        if (factIds.length === 0) return []
        const ids = [...new Set(factIds)]
        const [from, to] = await Promise.all([
            em.find(BrainFactRelationEntity, {
                where: { workspaceId, fromFactId: In(ids) },
                order: { createdAt: "ASC", id: "ASC" },
                take: RELATION_READ_MAX,
            }),
            em.find(BrainFactRelationEntity, {
                where: { workspaceId, toFactId: In(ids) },
                order: { createdAt: "ASC", id: "ASC" },
                take: RELATION_READ_MAX,
            }),
        ])
        const byId = new Map([...from, ...to].map((row) => [row.id, row]))
        return [...byId.values()].map((row) => toFactRelation(row))
    }

    /** Stores edges of the workspace; an edge already stored stays as it is. */
    private async insert(em: EntityManager, workspaceId: string, rows: ReadonlyArray<CheckedRelation>): Promise<void> {
        await em
            .createQueryBuilder(BrainFactRelationEntity, "r")
            .insert()
            .values(rows.map((relation) => ({ workspaceId, ...relation })))
            .orIgnore()
            .execute()
    }
}
