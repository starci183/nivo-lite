import { Test } from "@nestjs/testing"
import {
    AMOUNT_FACT,
    OWNER_EXAMPLE,
    amountIs,
    approverOf,
    branchOf,
    contextOf,
    decideOf,
    graphOf,
    nodeOf,
} from "@tests/fixtures/builders/agent-graph.builder"
import { GAP_ORDER, firstGapOf, graphGapsOf } from "./graph-gaps.policy"

/** The members of the subject under test. */
interface Subject {
    readonly graphGapsOf: typeof graphGapsOf
    readonly firstGapOf: typeof firstGapOf
}

const SUBJECT = Symbol("graph-gaps.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { graphGapsOf, firstGapOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** One decide node whose branches are all the things still vague at once. */
const VAGUE = graphOf([
    branchOf({ key: "under", when: amountIs("lt", 5_000_000) }),
    branchOf({
        key: "above",
        when: { all: [amountIs("gt", 5_000_000), amountIs("lte", 9_000_000)] },
        then: "ask",
        next: "ask",
        approver: null,
    }),
    branchOf({
        key: "wait",
        when: amountIs("gt", 9_000_000),
        then: "ask",
        next: "ask",
        approver: approverOf({ onTimeout: { kind: "unset" } }),
    }),
])

describe("graph-gaps.policy", () => {
    it("finds nothing vague in the owner example", async () => {
        const subject = await build()

        expect(subject.graphGapsOf(graphOf(OWNER_EXAMPLE), contextOf())).toEqual([])
        expect(subject.firstGapOf(graphOf(OWNER_EXAMPLE), contextOf())).toBeNull()
    })

    it("lists the gaps in the fixed order, whatever order the graph holds them in", async () => {
        const subject = await build()
        const context = contextOf({ groupHasPeople: () => false, approverCovers: () => false })

        const codes = subject.graphGapsOf(VAGUE, context).map((entry) => entry.code)

        expect(codes).toEqual([
            "boundary",
            "approver_missing",
            "approver_absent",
            "on_timeout",
            "else_unset",
            "approver_no_grant",
        ])
        expect(GAP_ORDER).toEqual(codes)
    })

    it("hands the setup chat the first gap only, the boundary before everything else", async () => {
        const subject = await build()

        expect(subject.firstGapOf(VAGUE, contextOf())).toEqual({
            code: "boundary",
            nodeKey: "decide",
            branchKey: "above",
        })
    })

    it("names the branch of each gap, and none for a missing else", async () => {
        const subject = await build()
        const noElse = graphOf([branchOf({ key: "all", when: { fact: AMOUNT_FACT, op: "known" } })])

        expect(subject.graphGapsOf(noElse, contextOf())).toEqual([
            { code: "else_unset", nodeKey: "decide", branchKey: null },
        ])
    })

    it("judges an approver against the top of the amounts of the branch", async () => {
        const subject = await build()
        const tops: Array<number | null> = []

        subject.graphGapsOf(
            graphOf(OWNER_EXAMPLE),
            contextOf({ approverCovers: (_action, _group, top) => (tops.push(top) > 0 ? true : true) }),
        )

        expect(tops).toEqual([20_000_000, null])
    })

    it("has nothing to say about a node that decides nothing, and treats a branch with no amount as having no top", async () => {
        const subject = await build()
        const noAmount = graphOf([
            branchOf({
                key: "kind",
                when: { fact: "supplier_payment.kind", op: "eq", value: "rent" },
                then: "ask",
                next: "ask",
                approver: approverOf(),
            }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])

        expect(subject.graphGapsOf({ nodes: [nodeOf()], rights: [] }, contextOf())).toEqual([])
        expect(subject.graphGapsOf(noAmount, contextOf({ approverCovers: () => false }))).toEqual([
            { code: "approver_no_grant", nodeKey: "decide", branchKey: "kind" },
        ])
        expect(decideOf([]).decide?.branches).toEqual([])
    })
})
