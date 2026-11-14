import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EXTRACTIONS_WS as WS, extractionRowOf as rowOf } from "@tests/fixtures/builders/brain-extractions.builder"
import { ExtractionNote } from "./brain-extractions.contracts"
import { BrainExtractionsService } from "./brain-extractions.service"
import { BrainExtractionEntity } from "./persistence/entities"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainExtractionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainExtractionsService)
}

describe("BrainExtractionsService truthsOf: what the document is (TRIAGE-2)", () => {
    const mixed = { version: 1, contentHash: "c", nature: "mixed", reason: "Price list and diary", sections: ["rules", "log", null], tables: {}, by: "model" }

    it("shows the model's reading: the nature, its reason, and how many sections of a mixed document are rule material", async () => {
        const service = await build(mockEntityManager({ find: [BrainExtractionEntity, [rowOf({ documentNature: mixed })]] }))
        expect((await service.truthsOf(WS, ["s1"])).get("s1")?.nature).toEqual({
            nature: "mixed",
            by: "model",
            reason: "Price list and diary",
            modelNature: null,
            ruleSections: 2,
            sections: 3,
            evidence: [],
            disagreesWith: [],
        })
    })

    it("shows the founder's answer over the model's, with what the model said", async () => {
        const row = rowOf({ documentNature: mixed, natureOverride: { nature: "reference", by: "Owner", at: "2026-11-12T00:00:00.000Z" } })
        const service = await build(mockEntityManager({ find: [BrainExtractionEntity, [row]] }))
        expect((await service.truthsOf(WS, ["s1"])).get("s1")?.nature).toEqual({
            nature: "reference",
            by: "founder",
            reason: "Price list and diary",
            modelNature: "mixed",
            ruleSections: null,
            sections: null,
            evidence: [],
            disagreesWith: [],
        })
    })
})

describe("BrainExtractionsService truthsOf: a document read before the stages", () => {
    it("says legacy with its note and the truths it filed, never done with zero passages", async () => {
        const old = rowOf({ status: "done", stage: null, passagesTotal: 0, passagesTriaged: 0, passagesKept: 0 })
        const service = await build(mockEntityManager({ find: [BrainExtractionEntity, [old]] }))
        const legacy = { state: "legacy", note: ExtractionNote.ReadOldWay, passagesTotal: 0, truthsFound: 7 }
        expect((await service.truthsOf(WS, ["s1"])).get("s1")).toMatchObject(legacy)
    })
})
