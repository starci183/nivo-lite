import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BrainFactsReadService, type FactRecord } from "@modules/domain/brain-facts"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { ShopTruthCandidates, TruthCandidate, TruthCandidateOptions } from "./document-critic.port"

/** The most keys one read looks up: a document filing more facts than this is compared on its first keys only. */
const KEYS_MAX = 40

/** True when every document evidence of a fact is this document (and it has some): the fact is the document's own. */
const onlyFrom = (fact: FactRecord, sourceId: string | null): boolean => {
    if (sourceId === null) return false
    const documents = fact.evidence.filter((item) => item.kind === "document")
    return documents.length > 0 && documents.every((item) => item.ref === sourceId)
}

@Injectable()
/**
 * The stand-in for BG2's meaning-based candidate read: per fact, the facts in force and the waiting proposals of the SAME key (subject +
 * attribute + instance), one indexed `keyed` read per key and status, at most 40 keys. It finds "small basket · price" against "small basket
 * · price", never "red roses" against "bunch of red roses" (other words = another key): that is what the vector read adds. No model call.
 */
export class KeyedTruthCandidatesService implements ShopTruthCandidates {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly reads: BrainFactsReadService,
    ) {}

    /** Per fact id, the other facts of its key in force or waiting, in force first. */
    async candidatesFor(
        workspaceId: string,
        facts: ReadonlyArray<FactRecord>,
        options: TruthCandidateOptions,
    ): Promise<ReadonlyMap<string, ReadonlyArray<TruthCandidate>>> {
        const keys = [...new Map(facts.map((fact) => [`${fact.subjectKey}|${fact.attribute}|${fact.installationId ?? ""}`, fact])).values()].slice(0, KEYS_MAX)
        const byKey = new Map<string, ReadonlyArray<FactRecord>>()
        await eachInOrder(keys, async (fact) => {
            const active = await this.reads.keyed(this.entityManager, workspaceId, fact.subjectKey, fact.attribute, "active", fact.installationId)
            const waiting = await this.reads.keyed(this.entityManager, workspaceId, fact.subjectKey, fact.attribute, "proposed", fact.installationId)
            byKey.set(`${fact.subjectKey}|${fact.attribute}|${fact.installationId ?? ""}`, [...active, ...waiting])
        })
        return new Map(
            facts.map((fact) => {
                const others = (byKey.get(`${fact.subjectKey}|${fact.attribute}|${fact.installationId ?? ""}`) ?? [])
                    .filter((other) => other.id !== fact.id && !onlyFrom(other, options.excludeSourceId))
                    .slice(0, options.perFact)
                return [fact.id, others.map((other): TruthCandidate => ({ fact: other, distance: null, match: "key" }))]
            }),
        )
    }
}
