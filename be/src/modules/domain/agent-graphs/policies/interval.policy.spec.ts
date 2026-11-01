import { Test } from "@nestjs/testing"
import { AMOUNT_FACT, FACTS, OWNER_EXAMPLE, amountIs, branchOf } from "@tests/fixtures/builders/agent-graph.builder"
import { amountFactOf, boundaryFindings, intervalOf, isEmpty, numericFactsOf, topOf } from "./interval.policy"

/** The members of the subject under test. */
interface Subject {
    readonly intervalOf: typeof intervalOf
    readonly topOf: typeof topOf
    readonly isEmpty: typeof isEmpty
    readonly numericFactsOf: typeof numericFactsOf
    readonly boundaryFindings: typeof boundaryFindings
    readonly amountFactOf: typeof amountFactOf
}

const SUBJECT = Symbol("interval.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { intervalOf, topOf, isEmpty, numericFactsOf, boundaryFindings, amountFactOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const decideOf = (...branches: Parameters<typeof boundaryFindings>[0]["branches"]) => ({
    intent: "pay_supplier",
    facts: [AMOUNT_FACT],
    branches,
})

describe("interval.policy intervalOf", () => {
    it("places one comparison on the line with its open and closed ends", async () => {
        const subject = await build()

        expect(subject.intervalOf(amountIs("lt", 5), AMOUNT_FACT)).toMatchObject({ hi: 5, hiOpen: true, loOpen: true })
        expect(subject.intervalOf(amountIs("lte", 5), AMOUNT_FACT)).toMatchObject({ hi: 5, hiOpen: false })
        expect(subject.intervalOf(amountIs("gt", 5), AMOUNT_FACT)).toMatchObject({ lo: 5, loOpen: true })
        expect(subject.intervalOf(amountIs("gte", 5), AMOUNT_FACT)).toMatchObject({ lo: 5, loOpen: false })
        expect(subject.intervalOf(amountIs("eq", 5), AMOUNT_FACT)).toEqual({
            lo: 5,
            loOpen: false,
            hi: 5,
            hiOpen: false,
        })
    })

    it("meets the terms of an all, keeping the tighter bound and the open end when they tie", async () => {
        const subject = await build()

        expect(
            subject.intervalOf({ all: [amountIs("gte", 1), amountIs("lt", 9), amountIs("lte", 20)] }, AMOUNT_FACT),
        ).toEqual({
            lo: 1,
            loOpen: false,
            hi: 9,
            hiOpen: true,
        })
        expect(
            subject.intervalOf(
                { all: [amountIs("gt", 1), amountIs("gte", 1), amountIs("lt", 9), amountIs("lte", 9)] },
                AMOUNT_FACT,
            ),
        ).toEqual({
            lo: 1,
            loOpen: true,
            hi: 9,
            hiOpen: true,
        })
        expect(
            subject.intervalOf(
                { all: [amountIs("gte", 5), amountIs("gte", 1), amountIs("lt", 20), amountIs("lt", 9)] },
                AMOUNT_FACT,
            ),
        ).toEqual({
            lo: 5,
            loOpen: false,
            hi: 9,
            hiOpen: true,
        })
    })
})

describe("interval.policy intervalOf (ties)", () => {
    it("opens a tied end when only the later term opens it, and takes the later bound when it is the tighter", async () => {
        const subject = await build()

        expect(
            subject.intervalOf(
                { all: [amountIs("gte", 1), amountIs("gt", 1), amountIs("lte", 9), amountIs("lt", 9)] },
                AMOUNT_FACT,
            ),
        ).toEqual({ lo: 1, loOpen: true, hi: 9, hiOpen: true })
        expect(
            subject.intervalOf(
                { all: [amountIs("gt", 1), amountIs("gte", 5), amountIs("lt", 20), amountIs("lt", 9)] },
                AMOUNT_FACT,
            ),
        ).toEqual({ lo: 5, loOpen: false, hi: 9, hiOpen: true })
    })

    it("cannot place an else, an any, a set, another fact, a text or a mix", async () => {
        const subject = await build()

        expect(subject.intervalOf("else", AMOUNT_FACT)).toBeNull()
        expect(subject.intervalOf({ any: [amountIs("lt", 1)] }, AMOUNT_FACT)).toBeNull()
        expect(subject.intervalOf({ fact: AMOUNT_FACT, op: "in", value: ["a"] }, AMOUNT_FACT)).toBeNull()
        expect(subject.intervalOf({ fact: AMOUNT_FACT, op: "known" }, AMOUNT_FACT)).toBeNull()
        expect(subject.intervalOf({ fact: AMOUNT_FACT, op: "lt", value: "x" }, AMOUNT_FACT)).toBeNull()
        expect(subject.intervalOf({ fact: AMOUNT_FACT, op: "neq", value: 1 }, AMOUNT_FACT)).toBeNull()
        expect(subject.intervalOf(amountIs("lt", 1), "other.fact")).toBeNull()
        expect(subject.intervalOf({ all: [amountIs("lt", 1), { any: [amountIs("lt", 1)] }] }, AMOUNT_FACT)).toBeNull()
    })
})

describe("interval.policy shape", () => {
    it("reads the top of an interval and whether it holds anything", async () => {
        const subject = await build()

        expect(subject.topOf({ lo: 0, loOpen: false, hi: 5, hiOpen: true })).toBe(5)
        expect(subject.topOf({ lo: 0, loOpen: false, hi: Number.POSITIVE_INFINITY, hiOpen: true })).toBeNull()
        expect(subject.isEmpty({ lo: 6, loOpen: false, hi: 5, hiOpen: false })).toBe(true)
        expect(subject.isEmpty({ lo: 5, loOpen: true, hi: 5, hiOpen: false })).toBe(true)
        expect(subject.isEmpty({ lo: 5, loOpen: false, hi: 5, hiOpen: false })).toBe(false)
    })

    it("lists the numeric facts of a decide point", async () => {
        const subject = await build()

        expect(
            subject.numericFactsOf(
                { intent: "x", facts: [AMOUNT_FACT, "supplier_payment.kind", "none"], branches: [] },
                FACTS,
            ),
        ).toEqual([AMOUNT_FACT])
    })
})

describe("interval.policy boundaryFindings", () => {
    it("finds nothing in the owner example", async () => {
        const subject = await build()

        expect(subject.boundaryFindings(decideOf(...OWNER_EXAMPLE), AMOUNT_FACT)).toEqual([])
    })

    it("finds the gap at the exact bound of under and above", async () => {
        const subject = await build()
        const under = branchOf({ key: "under", when: amountIs("lt", 5_000_000) })
        const above = branchOf({ key: "above", when: amountIs("gt", 5_000_000) })

        expect(subject.boundaryFindings(decideOf(under, above), AMOUNT_FACT)).toEqual([
            { kind: "gap", before: under, after: above },
        ])
    })

    it("finds a gap between two bounds that are further apart", async () => {
        const subject = await build()
        const low = branchOf({ key: "low", when: amountIs("lt", 1) })
        const high = branchOf({ key: "high", when: amountIs("gte", 9) })

        expect(subject.boundaryFindings(decideOf(low, high), AMOUNT_FACT)).toMatchObject([{ kind: "gap" }])
    })

    it("finds an overlap when both bounds include the number and when a stretch is shared", async () => {
        const subject = await build()
        const upTo = branchOf({ key: "upTo", when: amountIs("lte", 5_000_000) })
        const from = branchOf({ key: "from", when: amountIs("gte", 5_000_000) })
        const wide = branchOf({ key: "wide", when: amountIs("gte", 1) })

        expect(subject.boundaryFindings(decideOf(upTo, from), AMOUNT_FACT)).toMatchObject([{ kind: "overlap" }])
        expect(subject.boundaryFindings(decideOf(upTo, wide), AMOUNT_FACT)).toMatchObject([{ kind: "overlap" }])
    })

    it("accepts branches that meet exactly at one closed end and leaves out what cannot be placed", async () => {
        const subject = await build()
        const under = branchOf({ key: "under", when: amountIs("lt", 5) })
        const from = branchOf({ key: "from", when: amountIs("gte", 5) })
        const empty = branchOf({ key: "empty", when: { all: [amountIs("gt", 9), amountIs("lt", 3)] } })
        const other = branchOf({ key: "other", when: { fact: AMOUNT_FACT, op: "known" } })

        expect(subject.boundaryFindings(decideOf(under, from, empty, other), AMOUNT_FACT)).toEqual([])
        expect(subject.boundaryFindings(decideOf(from, under), AMOUNT_FACT)).toEqual([])
    })

    it("orders branches that share a lower bound by which end is open", async () => {
        const subject = await build()
        const open = branchOf({ key: "open", when: { all: [amountIs("gt", 1), amountIs("lt", 2)] } })
        const closed = branchOf({ key: "closed", when: { all: [amountIs("gte", 1), amountIs("lte", 5)] } })

        expect(subject.boundaryFindings(decideOf(open, closed), AMOUNT_FACT)).toMatchObject([{ kind: "overlap" }])
    })
})

describe("interval.policy amountFactOf", () => {
    it("is the first fact of the decide point counted in dong, whatever other amount facts the registry holds first", async () => {
        const subject = await build()
        const other = { key: "order.amount_vnd", type: "number", unit: "vnd", labelKey: "fact.order" } as const
        const registry = { [other.key]: other, ...FACTS }

        expect(subject.amountFactOf(decideOf(), registry)).toBe(AMOUNT_FACT)
        expect(subject.amountFactOf({ ...decideOf(), facts: [other.key, AMOUNT_FACT] }, registry)).toBe(other.key)
    })

    it("is none for a decide point that reads no amount", async () => {
        const subject = await build()

        expect(subject.amountFactOf({ ...decideOf(), facts: ["supplier_payment.kind"] }, FACTS)).toBeNull()
        expect(subject.amountFactOf({ ...decideOf(), facts: [] }, FACTS)).toBeNull()
    })
})
