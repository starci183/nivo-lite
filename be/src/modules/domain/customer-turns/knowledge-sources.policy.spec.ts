import { Test } from "@nestjs/testing"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { Passage } from "@modules/domain/knowledge"
import { recallSourcesOf as realRecallSourcesOf } from "./knowledge-sources.policy"

const SUBJECT = Symbol("knowledge-sources.policy")

/** The policy as the testing module provides it. */
const build = async (): Promise<typeof import("./knowledge-sources.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { recallSourcesOf: realRecallSourcesOf } }],
    }).compile()
    return moduleRef.get<typeof import("./knowledge-sources.policy")>(SUBJECT)
}

const passage = (overrides: Partial<Passage>): Passage => ({
    layer: "business",
    id: "chunk-1",
    sourceId: "src-1",
    module: "chatbot",
    kind: "document",
    title: "Price list 2026",
    content: "Deluxe 1.800.000 per night",
    score: 0.9,
    visibility: "public",
    topic: null,
    ...overrides,
})

const fact = (overrides: Partial<FactRecord>): FactRecord => ({
    id: "fact-1",
    subjectType: "product",
    subjectKey: "deluxe",
    subjectLabel: "Deluxe",
    attribute: "price",
    attributeLabel: "Price",
    value: "1.800.000",
    valueNumber: 1_800_000,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 100,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "owner-1",
    proposedAt: "2026-10-12T10:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    ...overrides,
})

describe("knowledge-sources.policy", () => {
    it("names the facts first, then each quoted document once, in recall order", async () => {
        const { recallSourcesOf } = await build()

        expect(
            recallSourcesOf(
                [fact({})],
                [
                    passage({}),
                    passage({ id: "chunk-2" }),
                    passage({ id: "chunk-3", sourceId: "src-2", title: "Rules" }),
                ],
            ),
        ).toEqual([
            { layer: 2, kind: "brain_fact", ref: "fact-1", label: "Deluxe - Price" },
            { layer: 2, kind: "brain_document", ref: "src-1", label: "Price list 2026" },
            { layer: 2, kind: "brain_document", ref: "src-2", label: "Rules" },
        ])
    })

    it("names a seeded NIVO passage as base knowledge and falls back to the passage id without a source", async () => {
        const { recallSourcesOf } = await build()

        expect(
            recallSourcesOf([], [passage({ layer: "nivo", sourceId: null, id: "nivo-7", title: "Spa operations" })]),
        ).toEqual([{ layer: 4, kind: "base_document", ref: "nivo-7", label: "Spa operations" }])
        expect(recallSourcesOf([], [])).toEqual([])
    })

    it("keeps at most ten sources", async () => {
        const { recallSourcesOf } = await build()
        const facts = Array.from({ length: 6 }, (_, index) => fact({ id: `fact-${String(index)}` }))
        const passages = Array.from({ length: 6 }, (_, index) => passage({ sourceId: `src-${String(index)}` }))

        expect(recallSourcesOf(facts, passages)).toHaveLength(10)
    })
})
