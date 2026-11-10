import { Injectable } from "@nestjs/common"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KeyedTruthCandidatesService } from "@modules/domain/dossier-review"
import type { ShopTruthCandidates, TruthCandidate, TruthCandidateOptions } from "@modules/domain/dossier-review"
import { FactEmbeddingsService } from "./fact-embeddings.service"

/** True when every document evidence of a fact is this document: the fact is the document's own, not the shop's. */
const onlyFrom = (fact: FactRecord, sourceId: string | null): boolean => {
    if (sourceId === null) return false
    const documents = fact.evidence.filter((item) => item.kind === "document")
    return documents.length > 0 && documents.every((item) => item.ref === sourceId)
}

@Injectable()
/**
 * The shop candidates of the document critic with BG2's meaning read: the exact key first (the stand-in of dossier-review, one indexed read
 * per key), then the facts in force or waiting that say the same thing in other words (`FactEmbeddingsService.nearMeaning`: it embeds only
 * the fact lines whose vector is not current, then one indexed read per fact). Rules use the key matches; the model judges the meaning ones.
 */
export class DocumentCriticCandidatesService implements ShopTruthCandidates {
    constructor(
        private readonly keyed: KeyedTruthCandidatesService,
        private readonly vectors: FactEmbeddingsService,
    ) {}

    /** Per fact id, the key matches then the meaning matches, at most `perFact` of each. */
    async candidatesFor(
        workspaceId: string,
        facts: ReadonlyArray<FactRecord>,
        options: TruthCandidateOptions,
    ): Promise<ReadonlyMap<string, ReadonlyArray<TruthCandidate>>> {
        const byKey = await this.keyed.candidatesFor(workspaceId, facts, options)
        const near = await this.vectors.nearMeaning(workspaceId, facts, {
            limit: options.perFact,
            excludeIds: facts.map((fact) => fact.id),
        })
        const byMeaning = new Map(
            near.map((one) => [
                one.fact.id,
                one.near
                    .filter((other) => !onlyFrom(other.fact, options.excludeSourceId))
                    .map((other): TruthCandidate => ({ fact: other.fact, distance: other.distance, match: "vector" })),
            ]),
        )
        return new Map(facts.map((fact) => [fact.id, [...(byKey.get(fact.id) ?? []), ...(byMeaning.get(fact.id) ?? [])]]))
    }
}
