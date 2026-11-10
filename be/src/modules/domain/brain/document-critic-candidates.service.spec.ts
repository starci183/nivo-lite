import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KeyedTruthCandidatesService } from "@modules/domain/dossier-review"
import { DocumentCriticCandidatesService } from "./document-critic-candidates.service"
import { FactEmbeddingsService } from "./fact-embeddings.service"

const WS = "11111111-1111-4111-8111-111111111111"
const factOf = (id: string, ref: string): FactRecord => ({ id, evidence: [{ kind: "document", ref, label: "doc" }] }) as unknown as FactRecord

const build = async () => {
    const keyed = mock<KeyedTruthCandidatesService>()
    const vectors = mock<FactEmbeddingsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentCriticCandidatesService,
            { provide: KeyedTruthCandidatesService, useValue: keyed },
            { provide: FactEmbeddingsService, useValue: vectors },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentCriticCandidatesService), keyed, vectors }
}

describe("DocumentCriticCandidatesService", () => {
    it("joins the exact-key matches and BG2's meaning matches, never the document's own facts, the meaning ones marked vector", async () => {
        const { service, keyed, vectors } = await build()
        const mine = factOf("rose", "s1")
        keyed.candidatesFor.mockResolvedValue(new Map([["rose", [{ fact: factOf("k1", "s0"), distance: null, match: "key" as const }]]]))
        vectors.nearMeaning.mockResolvedValue([
            { fact: mine, near: [{ fact: factOf("v1", "s0"), distance: 0.08 }, { fact: factOf("own", "s1"), distance: 0.01 }] },
        ])
        const found = await service.candidatesFor(WS, [mine], { perFact: 3, excludeSourceId: "s1" })
        expect(found.get("rose")?.map((one) => [one.fact.id, one.match, one.distance])).toEqual([
            ["k1", "key", null],
            ["v1", "vector", 0.08],
        ])
        expect(vectors.nearMeaning).toHaveBeenCalledWith(WS, [mine], { limit: 3, excludeIds: ["rose"] })
    })
})
