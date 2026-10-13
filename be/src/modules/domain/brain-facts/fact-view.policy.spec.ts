import type { FactRecord } from "./brain-facts.contracts"
import { factLine, inForce, searchFacts, visibleTo } from "./fact-view.policy"

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
    it("lets both audiences read public facts for their installation or every installation", () => {
        expect(visibleTo(fact(), "customer", "chatbot", null)).toBe(true)
        expect(visibleTo(fact(), "internal", "chatbot", "i2")).toBe(true)
        expect(visibleTo(fact({ installationId: "i1" }), "customer", "chatbot", "i1")).toBe(true)
        expect(visibleTo(fact({ installationId: "i1" }), "internal", "chatbot", "i2")).toBe(false)
        expect(visibleTo(fact({ installationId: "i1" }), "internal", "chatbot", null)).toBe(false)
    })

    it("limits internal facts to the internal audience", () => {
        expect(visibleTo(fact({ scope: "internal" }), "internal", "chatbot", null)).toBe(true)
        expect(visibleTo(fact({ scope: "internal" }), "customer", "chatbot", null)).toBe(false)
    })

    it("limits restricted facts to the internal audience and a named module", () => {
        const restricted = fact({ scope: "restricted", modules: ["chatbot"] })

        expect(visibleTo(restricted, "internal", "chatbot", null)).toBe(true)
        expect(visibleTo(restricted, "internal", "workflow", null)).toBe(false)
        expect(visibleTo(restricted, "customer", "chatbot", null)).toBe(false)
    })

    it("includes the start boundary and excludes the end boundary of a validity window", () => {
        const at = Date.parse("2026-01-01T00:00:00.000Z")

        expect(inForce({ validFrom: null, validTo: null }, at)).toBe(true)
        expect(inForce({ validFrom: "2026-01-01T00:00:00.000Z", validTo: "2026-01-02T00:00:00.000Z" }, at)).toBe(true)
        expect(inForce({ validFrom: "2026-01-02T00:00:00.000Z", validTo: null }, at)).toBe(false)
        expect(inForce({ validFrom: null, validTo: "2026-01-01T00:00:00.000Z" }, at)).toBe(false)
    })

    it("renders a fact as one prompt line", () => {
        expect(factLine(fact())).toBe("Combo - Price: 650000 VND")
    })

    it("ranks whole-word matches by weighted score, then by trust, and honors the limit", () => {
        const subject = fact({ id: "subject", subjectKey: "combo-thu-gian", trust: 20 })
        const both = fact({ id: "both", subjectKey: "combo-thu-gian", attribute: "combo-price", trust: 10 })
        const value = fact({ id: "value", subjectKey: "spa", value: "COMBO Th\u01b0 gi\u00e3n", trust: 30 })
        const attribute = fact({ id: "attribute", subjectKey: "spa", attribute: "combo", trust: 60 })
        const equal = fact({ id: "equal", subjectKey: "spa", attribute: "combo", trust: 60 })
        const partial = fact({ id: "partial", subjectKey: "combos", value: "combination", trust: 95 })
        const facts = [partial, value, equal, subject, attribute, both]

        expect(searchFacts(facts, "Combo COMBO a!", 5)).toEqual([both, subject, equal, attribute, value])
        expect(searchFacts(facts, "Combo COMBO a!", 2)).toEqual([both, subject])
        expect(searchFacts(facts, "TH\u01af GI\u00c3N", 5)).toEqual([subject, both, value])
        expect(searchFacts(facts, "a ?", 5)).toEqual([])
        expect(searchFacts(facts, "unknown", 5)).toEqual([])
        expect(searchFacts([], "combo", 5)).toEqual([])
    })
})
