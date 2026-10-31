import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, amountIs, approverOf, branchOf, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { applyLearned } from "./proposal-patch.policy"

/** The members of the subject under test. */
interface Subject {
    readonly applyLearned: typeof applyLearned
}

const SUBJECT = Symbol("proposal-patch.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { applyLearned } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const BASE = graphOf(OWNER_EXAMPLE)

/** The branches of the first node that decides. */
const branchesOf = (document: ReturnType<typeof graphOf>) =>
    document.nodes.find((node) => node.decide !== undefined)?.decide?.branches ?? []

describe("proposal-patch.policy a raised boundary", () => {
    it("moves the boundary between the auto branch and the asked one up to a whole million of the evidence, in both", async () => {
        const subject = await build()

        const raised = subject.applyLearned(BASE, {
            signal: "trust",
            branchKey: "middle",
            amounts: [6_000_000, 7_200_000],
        })

        expect(branchesOf(raised ?? BASE).map((branch) => [branch.key, branch.when, branch.selfCorrected])).toEqual([
            ["small", amountIs("lt", 8_000_000), true],
            ["middle", { all: [amountIs("gte", 8_000_000), amountIs("lt", 20_000_000)] }, true],
            ["else", "else", undefined],
        ])
    })

    it("keeps a boundary that already stands where the evidence would put it, and a branch the graph does not have", async () => {
        const subject = await build()

        expect(subject.applyLearned(BASE, { signal: "trust", branchKey: "middle", amounts: [4_000_000] })).toBeNull()
        expect(subject.applyLearned(BASE, { signal: "trust", branchKey: "gone", amounts: [9_000_000] })).toBeNull()
        expect(subject.applyLearned(BASE, { signal: "trust", branchKey: "middle", amounts: [] })).toBeNull()
    })

    it("finds no boundary under a branch with no auto branch right below it, or one not bounded by a number", async () => {
        const subject = await build()
        const apart = graphOf([
            branchOf({ key: "small", when: amountIs("lt", 1_000_000) }),
            branchOf({
                key: "middle",
                when: amountIs("gte", 5_000_000),
                then: "ask",
                next: "ask",
                approver: approverOf(),
            }),
            branchOf({ key: "else", when: "else", then: "ask", next: "ask", approver: approverOf() }),
        ])
        const asKnown = graphOf([
            branchOf({ key: "small", when: amountIs("lt", 5_000_000) }),
            branchOf({
                key: "middle",
                when: { fact: "supplier_payment.amount_vnd", op: "known" },
                then: "ask",
                next: "ask",
                approver: approverOf(),
            }),
        ])

        expect(subject.applyLearned(apart, { signal: "trust", branchKey: "middle", amounts: [9_000_000] })).toBeNull()
        expect(subject.applyLearned(asKnown, { signal: "trust", branchKey: "middle", amounts: [9_000_000] })).toBeNull()
        expect(subject.applyLearned(BASE, { signal: "trust", branchKey: "else", amounts: [9_000_000] })).toBeNull()
    })
})

describe("proposal-patch.policy a lowered boundary", () => {
    it("moves the boundary down to the whole million under the lowest amount of the evidence", async () => {
        const subject = await build()

        const lowered = subject.applyLearned(BASE, {
            signal: "reject",
            branchKey: "middle",
            amounts: [3_200_000, 6_000_000],
        })

        expect(branchesOf(lowered ?? BASE)[0]?.when).toEqual(amountIs("lt", 3_000_000))
        expect(branchesOf(lowered ?? BASE)[1]?.when).toEqual({
            all: [amountIs("gte", 3_000_000), amountIs("lt", 20_000_000)],
        })
    })

    it("does nothing when the evidence is not below the boundary", async () => {
        const subject = await build()

        expect(subject.applyLearned(BASE, { signal: "reject", branchKey: "middle", amounts: [9_000_000] })).toBeNull()
    })
})

describe("proposal-patch.policy a backup", () => {
    it("names the owners as the backup of an asked branch that has none", async () => {
        const subject = await build()

        const backed = subject.applyLearned(BASE, { signal: "timeout", branchKey: "middle", amounts: [] })

        expect(branchesOf(backed ?? BASE)[1]?.approver?.onTimeout).toEqual({
            kind: "backup",
            group: { roles: ["owner"], rooms: [], members: [] },
        })
    })

    it("does nothing for a branch that is gone, asks nobody, or has a backup already", async () => {
        const subject = await build()
        const backed = subject.applyLearned(BASE, { signal: "timeout", branchKey: "middle", amounts: [] }) ?? BASE

        expect(subject.applyLearned(BASE, { signal: "timeout", branchKey: "gone", amounts: [] })).toBeNull()
        expect(subject.applyLearned(BASE, { signal: "timeout", branchKey: "small", amounts: [] })).toBeNull()
        expect(subject.applyLearned(backed, { signal: "timeout", branchKey: "middle", amounts: [] })).toBeNull()
    })
})
