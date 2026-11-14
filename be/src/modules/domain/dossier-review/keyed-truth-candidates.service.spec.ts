import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KeyedTruthCandidatesService } from "./keyed-truth-candidates.service"

const WS = "11111111-1111-4111-8111-111111111111"
const SRC = "22222222-2222-4222-8222-222222222222"

const factOf = (id: string, attribute: string, status: FactRecord["status"], ref = SRC): FactRecord =>
    mock<FactRecord>({ id, subjectKey: "repair", attribute, installationId: null, status, evidence: [{ kind: "document", ref, label: "doc" }] })

const build = async () => {
    const reads = mock<BrainFactsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KeyedTruthCandidatesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: BrainFactsReadService, useValue: reads },
        ],
    }).compile()
    return { service: moduleRef.get(KeyedTruthCandidatesService), reads }
}

describe("KeyedTruthCandidatesService: what stands for the key of each waiting truth", () => {
    it("reads EVERY key a waiting truth sits on, however many the document files: none is left with nothing in force beside it", async () => {
        const { service, reads } = await build()
        const waiting = Array.from({ length: 75 }, (_unused, index) => factOf(`w${String(index)}`, `attribute-${String(index)}`, "proposed"))
        reads.keyed.mockImplementation((_em, _ws, _subject, attribute, status) =>
            Promise.resolve(status === "active" && attribute === "attribute-74" ? [factOf("live", "attribute-74", "active", "another-document")] : []),
        )

        const found = await service.candidatesFor(WS, waiting, { perFact: 12, excludeSourceId: SRC })

        expect(new Set(reads.keyed.mock.calls.map((call) => call[3])).size).toBe(75)
        expect(found.get("w74")?.map((one) => [one.fact.id, one.match])).toEqual([["live", "key"]])
        expect(found.get("w0")).toEqual([])
    })

    it("a truth already in force is not compared again; the document's own truths are never its rivals; in force comes before waiting", async () => {
        const { service, reads } = await build()
        const settled = factOf("settled", "hours", "active")
        const waiting = factOf("waiting", "price", "proposed")
        reads.keyed.mockImplementation((_em, _ws, _subject, _attribute, status) =>
            Promise.resolve(
                status === "active"
                    ? [factOf("own", "price", "active"), factOf("live", "price", "active", "another-document")]
                    : [waiting, factOf("other-waiting", "price", "proposed", "another-document")],
            ),
        )

        const found = await service.candidatesFor(WS, [settled, waiting], { perFact: 12, excludeSourceId: SRC })

        expect(reads.keyed.mock.calls.map((call) => [call[3], call[4]])).toEqual([
            ["price", "active"],
            ["price", "proposed"],
        ])
        expect(found.get("waiting")?.map((one) => one.fact.id)).toEqual(["live", "other-waiting"])
    })
})
