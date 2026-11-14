import { Test } from "@nestjs/testing"
import type { Evidence, FactRecord } from "@modules/domain/brain-facts"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import {
    evidenceLinesOf,
    factLineOf,
    instantOf,
    isServed,
    readNowOf,
    servedLineOf,
    sourceLineOf,
    valueNowOf,
    viewOfCall,
} from "./native-view.policy"
import { COST_PRICE_FILE_VI } from "@tests/fixtures/i18n/native-tools-spec.messages"

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
            num: null,
            trust: 95,
        })
    })

    it("carries the number the store read from the value, for a code that copies a price", async () => {
        const subject = await build()
        expect(subject.factLineOf(fact({ unit: null, value: "55.000 d", valueNumber: 55_000 })).num).toBe(55_000)
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

describe("evidenceLinesOf for a customer-facing view", () => {
    it("keeps the kind only: a label may name an internal document or room", () => {
        expect(evidenceLinesOf([{ kind: "document", ref: "d", label: COST_PRICE_FILE_VI }], true)).toEqual([{ kind: "document" }])
    })
})

describe("the served line of a truth (owner order 2026-11-11, item 2)", () => {
    const AT = Date.parse("2026-11-11T10:00:00.000Z")
    const INTERNAL = { audience: "internal" as const, module: "sales", installationId: null }

    it("writes an instant as the day at midnight UTC, else to the minute", () => {
        expect(instantOf("2026-11-11T00:00:00.000Z")).toBe("2026-11-11")
        expect(instantOf("2026-11-11T17:00:00.000Z")).toBe("2026-11-11T17:00Z")
        expect(instantOf("not a date")).toBe("not a date")
    })

    it("says whether a value holds now, starts later or has ended", () => {
        expect(valueNowOf(facts.factOf({ validFrom: "2026-11-01T00:00:00.000Z" }), AT)).toBe("in")
        expect(valueNowOf(facts.factOf({ validFrom: "2026-12-01T00:00:00.000Z" }), AT)).toBe("later")
        expect(valueNowOf(facts.factOf({ validTo: "2026-11-01T00:00:00.000Z" }), AT)).toBe("ended")
    })

    it("names the source by who said it, its newest evidence's title or label and date; never the label to a customer view", () => {
        const fact = facts.factOf({
            sourceKind: "owner",
            evidence: [
                { kind: "document", ref: "d1", label: "old", at: "2026-10-01T00:00:00.000Z" },
                { kind: "message", ref: "team-chat:m", label: "Private chat with an agent", at: "2026-11-10T09:30:00.000Z" },
            ],
        })

        expect(sourceLineOf(fact, false)).toEqual({ kind: "owner", label: "Private chat with an agent", at: "2026-11-10T09:30Z" })
        expect(sourceLineOf(fact, true)).toEqual({ kind: "owner", at: "2026-11-10T09:30Z" })
        expect(sourceLineOf(facts.factOf({ evidence: [], decidedAt: "2026-11-02T00:00:00.000Z" }), false)).toEqual({
            kind: "staff",
            at: "2026-11-02",
        })
    })

    it("reads now only the facts in force, in the lens, not shadowed", () => {
        const shopWide = facts.factOf({ id: "shop", status: "active" })
        const own = facts.factOf({ id: "own", status: "active", installationId: "inst-1" })
        const waiting = facts.factOf({ id: "wait", status: "proposed" })
        const ended = facts.factOf({ id: "ended", status: "active", attribute: "x", validTo: "2026-11-01T00:00:00.000Z" })

        expect([...readNowOf([shopWide, own, waiting, ended], { ...INTERNAL, installationId: "inst-1" }, AT)]).toEqual(["own"])
        expect([...readNowOf([shopWide, own, waiting, ended], INTERNAL, AT)]).toEqual(["shop"])
    })

    it("names a waiting request to stop the value as a dispute with no value; the same value waiting is no dispute", () => {
        const fact = facts.factOf({ id: "f", status: "active", value: "8h" })
        const retire = facts.factOf({ id: "r", status: "proposed", proposalKind: "retire", conflictWith: "f" })
        const same = facts.factOf({ id: "s", status: "proposed", value: "8H" })
        const line = servedLineOf(fact, { at: AT, view: INTERNAL, kin: [fact, retire, same], readNow: new Set(["f"]) })

        expect(line.disputed).toMatchObject([{ id: "r", value: null, unit: null, src: { kind: "staff" }, now: "wait" }])
        expect(line.disputed).toHaveLength(1)
        expect(line).not.toHaveProperty("next")
    })
})
