import { Test } from "@nestjs/testing"
import type { FactRecord } from "./brain-facts.contracts"
import { factLine, inForce, searchFacts, visibleTo } from "./fact-view.policy"
const SUBJECT = Symbol("fact-view.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { visibleTo, inForce, factLine, searchFacts } }],
    }).compile()
    return moduleRef.get<typeof import("./fact-view.policy")>(SUBJECT)
}

const fact = (overrides: Partial<FactRecord> = {}): FactRecord => ({
    id: "f1",
    subjectType: "product",
    subjectKey: "combo",
    subjectLabel: "Combo",
    attribute: "price",
    attributeLabel: "Price",
    value: "650000 VND",
    valueNumber: 650000,
    unit: "VND",
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "u1",
    proposedAt: "2026-01-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    ...overrides,
})

describe("fact views", () => {
    it("lets both audiences read public facts for their installation or every installation", async () => {
        const subject = await build()

        expect(subject.visibleTo(fact(), "customer", "chatbot", null)).toBe(true)
        expect(subject.visibleTo(fact(), "internal", "chatbot", "i2")).toBe(true)
        expect(subject.visibleTo(fact({ installationId: "i1" }), "customer", "chatbot", "i1")).toBe(true)
        expect(subject.visibleTo(fact({ installationId: "i1" }), "internal", "chatbot", "i2")).toBe(false)
        expect(subject.visibleTo(fact({ installationId: "i1" }), "internal", "chatbot", null)).toBe(false)
    })

    it("limits internal facts to the internal audience", async () => {
        const subject = await build()

        expect(subject.visibleTo(fact({ scope: "internal" }), "internal", "chatbot", null)).toBe(true)
        expect(subject.visibleTo(fact({ scope: "internal" }), "customer", "chatbot", null)).toBe(false)
    })

    it("limits restricted facts to the internal audience and a named module", async () => {
        const subject = await build()

        const restricted = fact({ scope: "restricted", modules: ["chatbot"] })

        expect(subject.visibleTo(restricted, "internal", "chatbot", null)).toBe(true)
        expect(subject.visibleTo(restricted, "internal", "workflow", null)).toBe(false)
        expect(subject.visibleTo(restricted, "customer", "chatbot", null)).toBe(false)
    })

    it("includes the start boundary and excludes the end boundary of a validity window", async () => {
        const subject = await build()

        const at = Date.parse("2026-01-01T00:00:00.000Z")

        expect(subject.inForce({ validFrom: null, validTo: null }, at)).toBe(true)
        expect(
            subject.inForce({ validFrom: "2026-01-01T00:00:00.000Z", validTo: "2026-01-02T00:00:00.000Z" }, at),
        ).toBe(true)
        expect(subject.inForce({ validFrom: "2026-01-02T00:00:00.000Z", validTo: null }, at)).toBe(false)
        expect(subject.inForce({ validFrom: null, validTo: "2026-01-01T00:00:00.000Z" }, at)).toBe(false)
    })

    it("renders a fact as one prompt line", async () => {
        const subject = await build()

        expect(subject.factLine(fact())).toBe("Combo - Price: 650000 VND")
    })

    it("ranks whole-word matches by weighted score, then by trust, and honors the limit", async () => {
        const subject = await build()

        const subjectFact = fact({ id: "subject", subjectKey: "combo-thu-gian", trust: 20 })
        const both = fact({ id: "both", subjectKey: "combo-thu-gian", attribute: "combo-price", trust: 10 })
        const value = fact({ id: "value", subjectKey: "spa", value: "COMBO Th\u01b0 gi\u00e3n", trust: 30 })
        const attribute = fact({ id: "attribute", subjectKey: "spa", attribute: "combo", trust: 60 })
        const equal = fact({ id: "equal", subjectKey: "spa", attribute: "combo", trust: 60 })
        const partial = fact({ id: "partial", subjectKey: "combos", value: "combination", trust: 95 })
        const facts = [partial, value, equal, subjectFact, attribute, both]

        expect(subject.searchFacts(facts, "Combo COMBO a!", 5)).toEqual([both, subjectFact, equal, attribute, value])
        expect(subject.searchFacts(facts, "Combo COMBO a!", 2)).toEqual([both, subjectFact])
        expect(subject.searchFacts(facts, "TH\u01af GI\u00c3N", 5)).toEqual([subjectFact, both, value])
        expect(subject.searchFacts(facts, "a ?", 5)).toEqual([])
        expect(subject.searchFacts(facts, "unknown", 5)).toEqual([])
        expect(subject.searchFacts([], "combo", 5)).toEqual([])
    })
})
