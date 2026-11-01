import { Test } from "@nestjs/testing"
import type { Evidence, FactRecord } from "@modules/domain/brain-facts"
import { evidenceLinesOf, factLineOf, isServed, viewOfCall } from "./native-view.policy"

/** The members of the subject under test. */
interface Subject {
    readonly viewOfCall: typeof viewOfCall
    readonly evidenceLinesOf: typeof evidenceLinesOf
    readonly factLineOf: typeof factLineOf
    readonly isServed: typeof isServed
}

const SUBJECT = Symbol("native-view.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { viewOfCall, evidenceLinesOf, factLineOf, isServed } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const WS = "11111111-1111-4111-8111-111111111111"

describe("viewOfCall", () => {
    it("gives an internal module the internal view of its instance when no conversation is served", async () => {
        const subject = await build()
        expect(subject.viewOfCall(WS, { module: "sales", installationId: "i1" }, null)).toEqual({
            workspaceId: WS,
            module: "sales",
            audience: "internal",
            installationId: "i1",
            searchable: true,
        })
    })

    it("narrows an internal module to the customer view when the call serves a conversation", async () => {
        const subject = await build()
        expect(subject.viewOfCall(WS, { module: "sales", installationId: null }, "c1")).toMatchObject({
            audience: "customer",
            installationId: null,
        })
    })

    it("gives a customer-facing module and a publishing one the customer view whatever is asked", async () => {
        const subject = await build()
        expect(subject.viewOfCall(WS, { module: "chatbot", installationId: null }, null).audience).toBe("customer")
        expect(subject.viewOfCall(WS, { module: "content", installationId: null }, null).audience).toBe("customer")
    })

    it("reads an unknown module as customer-facing and not searchable", async () => {
        const subject = await build()
        expect(subject.viewOfCall(WS, { module: "gone", installationId: null }, null)).toMatchObject({
            module: "gone",
            audience: "customer",
            searchable: false,
        })
    })

    it("always answers for the workspace of the caller", async () => {
        const subject = await build()
        expect(subject.viewOfCall("other", { module: "sales", installationId: null }, null).workspaceId).toBe("other")
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
    it("withholds customer and person subjects and serves the rest", async () => {
        const subject = await build()
        expect(subject.isServed(fact({ subjectType: "customer" }))).toBe(false)
        expect(subject.isServed(fact({ subjectType: "person" }))).toBe(false)
        expect(subject.isServed(fact({ subjectType: "product" }))).toBe(true)
    })
})

describe("factLineOf", () => {
    it("keeps what a fact says and how far it is believed, nothing of its source or scope", async () => {
        const subject = await build()
        expect(subject.factLineOf(fact({ unit: "VND", value: "50000" }))).toEqual({
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
    it("drops the quote, the reference and the connection of each item", async () => {
        const subject = await build()
        const items: ReadonlyArray<Evidence> = [
            { kind: "document", ref: "https://x", label: "Price list", quote: "secret words", connectionId: "c1" },
            { kind: "manual", ref: "u1", label: "Owner" },
        ]

        expect(subject.evidenceLinesOf(items)).toEqual([
            { kind: "document", label: "Price list" },
            { kind: "manual", label: "Owner" },
        ])
    })
})
