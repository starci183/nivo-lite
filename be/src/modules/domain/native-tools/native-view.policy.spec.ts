import type { Evidence, FactRecord } from "@modules/domain/brain-facts"
import { evidenceLinesOf, factLineOf, isServed, viewOfCall } from "./native-view.policy"

const WS = "11111111-1111-4111-8111-111111111111"

describe("viewOfCall", () => {
    it("gives an internal module the internal view of its instance when no conversation is served", () => {
        expect(viewOfCall(WS, { module: "sales", installationId: "i1" }, null)).toEqual({
            workspaceId: WS,
            module: "sales",
            audience: "internal",
            installationId: "i1",
            searchable: true,
        })
    })

    it("narrows an internal module to the customer view when the call serves a conversation", () => {
        expect(viewOfCall(WS, { module: "sales", installationId: null }, "c1")).toMatchObject({
            audience: "customer",
            installationId: null,
        })
    })

    it("gives a customer-facing module and a publishing one the customer view whatever is asked", () => {
        expect(viewOfCall(WS, { module: "chatbot", installationId: null }, null).audience).toBe("customer")
        expect(viewOfCall(WS, { module: "content", installationId: null }, null).audience).toBe("customer")
    })

    it("reads an unknown module as customer-facing and not searchable", () => {
        expect(viewOfCall(WS, { module: "gone", installationId: null }, null)).toMatchObject({
            module: "gone",
            audience: "customer",
            searchable: false,
        })
    })

    it("always answers for the workspace of the caller", () => {
        expect(viewOfCall("other", { module: "sales", installationId: null }, null).workspaceId).toBe("other")
    })
})

const fact = (changes: Partial<FactRecord> = {}): FactRecord => ({
    id: "f1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
    valueNumber: null,
    unit: null,
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
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    ...changes,
})

describe("isServed", () => {
    it("withholds customer and person subjects and serves the rest", () => {
        expect(isServed(fact({ subjectType: "customer" }))).toBe(false)
        expect(isServed(fact({ subjectType: "person" }))).toBe(false)
        expect(isServed(fact({ subjectType: "product" }))).toBe(true)
    })
})

describe("factLineOf", () => {
    it("keeps what a fact says and how far it is believed, nothing of its source or scope", () => {
        expect(factLineOf(fact({ unit: "VND", value: "50000" }))).toEqual({
            id: "f1",
            subject: "Shop",
            attribute: "Hours",
            value: "50000",
            unit: "VND",
            trust: 95,
        })
    })
})

describe("evidenceLinesOf", () => {
    it("drops the quote, the reference and the connection of each item", () => {
        const items: ReadonlyArray<Evidence> = [
            { kind: "document", ref: "https://x", label: "Price list", quote: "secret words", connectionId: "c1" },
            { kind: "manual", ref: "u1", label: "Owner" },
        ]

        expect(evidenceLinesOf(items)).toEqual([
            { kind: "document", label: "Price list" },
            { kind: "manual", label: "Owner" },
        ])
    })
})
