import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import { conflictsOf, knownLinesOf, unmentionedConflicts } from "./setup-facts.policy"
import type { ProposedWrite } from "./setup-writes.policy"

const SUBJECT = Symbol("setup-facts.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { conflictsOf, knownLinesOf, unmentionedConflicts } }],
    }).compile()
    return moduleRef.get<typeof import("./setup-facts.policy")>(SUBJECT)
}

const factOf = builder<FactRecord>({
    id: "f-1",
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
    trust: 50,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "u-1",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const writeOf = (subjectLabel: string, attributeLabel: string, value: string): ProposedWrite => ({
    gateKey: "hours",
    kind: "fact",
    payload: { subjectType: "business", subjectLabel, attributeLabel, value, scope: "public" },
})

describe("knownLinesOf", () => {
    it("gives 30 lines out of 31 facts", async () => {
        const subject = await build()
        const facts = Array.from({ length: 31 }, (_, at) => factOf({ id: `f-${at}`, value: `v${at}` }))

        expect(subject.knownLinesOf(facts, [])).toHaveLength(30)
    })

    it("keeps the lines inside 2400 characters and clips each to 160", async () => {
        const subject = await build()
        const facts = Array.from({ length: 30 }, (_, at) => factOf({ id: `f-${at}`, value: "x".repeat(400) }))

        const lines = subject.knownLinesOf(facts, [])

        expect(lines.every((line) => line.length <= 160)).toBe(true)
        expect(lines.join("").length).toBeLessThanOrEqual(2400)
        expect(lines).toHaveLength(15)
    })

    it("puts a hit before a fact of higher trust and the rest by trust", async () => {
        const subject = await build()
        const hit = factOf({ id: "hit", value: "hit", trust: 10 })
        const high = factOf({ id: "high", value: "high", trust: 90 })
        const mid = factOf({ id: "mid", value: "mid", trust: 50 })

        expect(subject.knownLinesOf([mid, hit, high], [hit])).toEqual([
            "- Shop - Hours: hit",
            "- Shop - Hours: high",
            "- Shop - Hours: mid",
        ])
    })

    it("drops customers and people", async () => {
        const subject = await build()
        const facts = [
            factOf({ id: "c", subjectType: "customer", value: "c" }),
            factOf({ id: "p", subjectType: "person", value: "p" }),
            factOf({ id: "b", value: "b" }),
        ]

        expect(subject.knownLinesOf(facts, [facts[0] ?? factOf()])).toEqual(["- Shop - Hours: b"])
    })
})

describe("conflictsOf", () => {
    it("finds a value that differs from the one in force", async () => {
        const subject = await build()

        expect(subject.conflictsOf([writeOf("Shop", "Hours", "9 to 17")], [factOf()])).toEqual([
            { subject: "Shop", attribute: "Hours", current: "8 to 21", proposed: "9 to 17" },
        ])
    })

    it("ignores a value that is the same", async () => {
        const subject = await build()

        expect(subject.conflictsOf([writeOf("shop", "hours", "8  to 21")], [factOf()])).toEqual([])
    })

    it("ignores an unrelated key and a rule", async () => {
        const subject = await build()
        const rule: ProposedWrite = {
            gateKey: "g",
            kind: "rule",
            payload: { action: "refund", field: "mode", mode: "ask", limitVnd: undefined },
        }

        expect(subject.conflictsOf([writeOf("Shop", "Phone", "123"), writeOf("Bar", "Hours", "1"), rule], [factOf()])).toEqual([])
    })
})

describe("unmentionedConflicts", () => {
    const conflict = (current: string) => ({ subject: "Shop", attribute: "Hours", current, proposed: "x" })

    it("skips a conflict whose current value the reply names and takes two at most", async () => {
        const subject = await build()

        expect(
            subject.unmentionedConflicts([conflict("A"), conflict("B"), conflict("C"), conflict("D")], "You said A only"),
        ).toEqual([conflict("B"), conflict("C")])
    })
})
