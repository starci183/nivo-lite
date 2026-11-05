import { Test } from "@nestjs/testing"
import { findingRowOf } from "@tests/fixtures/builders/dossier-review-services.builder"
import { mock } from "@starci/jest-preset"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { DossierFindingInUseService } from "./dossier-finding-in-use.service"

const WS = "ws-1"
const OTHER = "aaaaaaaa-0000-4000-8000-000000000002"

const side = (factId: string | null, sourceTitle: string) => ({
    role: "claim" as const,
    label: "Price",
    sourceId: null,
    sourceTitle,
    passageId: null,
    factId,
    factLine: null,
    quote: null,
})

// The service reads three columns of a fact; the rest of the record is not part of this proof.
const factOf = (id: string, status: FactRecord["status"], value: string): FactRecord =>
    Object.assign(mock<FactRecord>(), { id, status, value })

const build = async (known: ReadonlyArray<FactRecord>) => {
    const facts = mock<BrainFactsReadService>({
        get: jest.fn((_workspaceId: string, id: string) =>
            Promise.resolve(known.find((fact) => fact.id === id) ?? null),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [DossierFindingInUseService, { provide: BrainFactsReadService, useValue: facts }],
    }).compile()
    return { facts, service: moduleRef.get(DossierFindingInUseService) }
}

describe("DossierFindingInUseService", () => {
    it("names the value of the one active fact of a contradiction and has no entry for other findings", async () => {
        const { facts, service } = await build([factOf("fa", "proposed", "480.000"), factOf("fb", "active", "450.000")])
        const contradiction = findingRowOf({
            kind: "contradiction",
            evidence: [side("fa", "Menu"), side("fb", "Bang gia 2026"), side(null, "Note")],
        })

        const inUse = await service.ofFindings(WS, [contradiction, findingRowOf({ id: OTHER })])

        expect(inUse.get(contradiction.id)).toEqual({ value: "450.000", sourceTitle: "Bang gia 2026" })
        expect(inUse.has(OTHER)).toBe(false)
        expect(facts.get).toHaveBeenCalledTimes(2)
    })

    it("names nothing when no cited fact is active or one is gone", async () => {
        const { service } = await build([factOf("fa", "proposed", "480.000")])
        const contradiction = findingRowOf({ kind: "contradiction", evidence: [side("fa", "Menu"), side("fb", "Gia")] })

        const inUse = await service.ofFindings(WS, [contradiction])

        expect(inUse.get(contradiction.id)).toBeNull()
    })
})
