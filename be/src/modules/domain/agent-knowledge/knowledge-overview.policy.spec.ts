import { Test } from "@nestjs/testing"
import type { LensLanes } from "@modules/domain/agents"
import type { FactRecord, FactStatus, Scope } from "@modules/domain/brain-facts"
import type { ReadableSummary } from "@modules/domain/knowledge-sources"
import { documentsOf, layersOf, ownFactsOf, waitingOf } from "./knowledge-overview.policy"

const SUBJECT = Symbol("knowledge-overview.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { documentsOf, layersOf, ownFactsOf, waitingOf } }],
    }).compile()
    return moduleRef.get<typeof import("./knowledge-overview.policy")>(SUBJECT)
}

const TEAM: LensLanes = {
    documentPublic: true,
    documentInternal: true,
    factPublic: true,
    factInternal: true,
    factRestricted: true,
}
const PUBLIC_ONLY: LensLanes = { ...TEAM, documentInternal: false, factInternal: false, factRestricted: false }

const factOf = (id: string, scope: Scope, status: FactStatus, source?: string): FactRecord => ({
    id,
    subjectType: "policy",
    subjectKey: id,
    subjectLabel: `Subject ${id}`,
    attribute: "value",
    attributeLabel: "Value",
    value: "10",
    valueNumber: 10,
    unit: "VND",
    scope,
    modules: scope === "restricted" ? ["sales"] : [],
    installationId: null,
    status,
    sourceKind: "document",
    trust: 80,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: source === undefined ? [] : [{ kind: "document", ref: source, label: "doc" }],
    proposedBy: "system",
    proposedAt: "2026-11-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const docOf = (id: string, visibility: "public" | "internal"): ReadableSummary => ({
    id,
    title: `Doc ${id}`,
    topic: null,
    kind: "text",
    visibility,
    updatedAt: "2026-11-07T00:00:00.000Z",
})

const DOCS = [docOf("d1", "public"), docOf("d2", "internal")]
const F1 = factOf("f1", "public", "active", "d1")
const F2 = factOf("f2", "public", "proposed", "d1")
const F3 = factOf("f3", "internal", "proposed", "d2")
const F4 = factOf("f4", "restricted", "active")
const F5 = factOf("f5", "restricted", "proposed")
const FACTS = [F1, F2, F3, F4, F5]

describe("layersOf", () => {
    it("counts documents and approved and total facts per layer for a team view", async () => {
        const subject = await build()
        expect(subject.layersOf(DOCS, FACTS, TEAM)).toEqual([
            { layer: "public", isRead: true, documents: 1, approvedFacts: 1, totalFacts: 2 },
            { layer: "internal", isRead: true, documents: 1, approvedFacts: 0, totalFacts: 1 },
            { layer: "restricted", isRead: true, documents: 0, approvedFacts: 1, totalFacts: 2 },
        ])
    })

    it("marks the internal layer unread for a view that reads public knowledge only, and still counts it", async () => {
        const subject = await build()
        const layers = subject.layersOf(DOCS, FACTS, PUBLIC_ONLY)
        expect(layers[1]).toEqual({ layer: "internal", isRead: false, documents: 1, approvedFacts: 0, totalFacts: 1 })
        expect(layers[0]?.isRead).toBe(true)
    })
})

describe("documentsOf", () => {
    it("counts the approved and waiting facts read from each document and flags unread ones", async () => {
        const subject = await build()
        expect(subject.documentsOf(DOCS, FACTS, PUBLIC_ONLY)).toEqual([
            expect.objectContaining({ id: "d1", layer: "public", isRead: true, approvedFacts: 1, waitingFacts: 1 }),
            expect.objectContaining({ id: "d2", layer: "internal", isRead: false, approvedFacts: 0, waitingFacts: 1 }),
        ])
    })
})

describe("ownFactsOf", () => {
    it("lists restricted facts with the approved ones first", async () => {
        const subject = await build()
        expect(subject.ownFactsOf([F5, F4, F1])).toEqual([
            { id: "f4", label: "Subject f4 · Value", value: "10 VND", isApproved: true },
            { id: "f5", label: "Subject f5 · Value", value: "10 VND", isApproved: false },
        ])
    })
})

describe("waitingOf", () => {
    it("counts only the waiting facts the view would read once approved", async () => {
        const subject = await build()
        expect(subject.waitingOf(FACTS, TEAM)).toBe(3)
        expect(subject.waitingOf(FACTS, PUBLIC_ONLY)).toBe(1)
    })
})
