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
import { GAP_ORDER, graphGapsOf } from "./graph-gaps.policy"

/** The members of the subject under test. */
interface Subject {
    readonly graphGapsOf: typeof graphGapsOf
}

const SUBJECT = Symbol("graph-gaps.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { graphGapsOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** One decide node whose branches are all the things still vague at once. */
const VAGUE = graphOf([
    branchOf({ key: "under", when: amountIs("lt", 5_000_000) }),
    branchOf({
        key: "above",
        when: { all: [amountIs("gt", 5_000_000), amountIs("lte", 9_000_000)] },
        mode: "ask",
        next: "ask",
        approver: null,
    }),
    branchOf({
        key: "wait",
        when: amountIs("gt", 9_000_000),
        mode: "ask",
        next: "ask",
        approver: approverOf({ onTimeout: { kind: "unset" } }),
    }),
])

describe("graph-gaps.policy", () => {
    it("finds nothing vague in the owner example", async () => {
        const subject = await build()

        expect(subject.graphGapsOf(graphOf(OWNER_EXAMPLE), contextOf())).toEqual([])
    })

    it("lists the gaps in the fixed order, whatever order the graph holds them in", async () => {
        const subject = await build()
        const codes = subject.graphGapsOf(VAGUE, contextOf()).map((entry) => entry.code)

        expect(codes).toEqual(["boundary", "approver_missing", "on_timeout", "else_unset"])
        expect(GAP_ORDER).toEqual(codes)
    })

    it("names the branch of each gap, and none for a missing else", async () => {
        const subject = await build()
        const noElse = graphOf([branchOf({ key: "all", when: { fact: AMOUNT_FACT, op: "known" } })])

        expect(subject.graphGapsOf(noElse, contextOf())).toEqual([
            { code: "else_unset", nodeKey: "decide", branchKey: null },
        ])
    })

    it("has nothing to say about a node that decides nothing, nor about who an approver is", async () => {
        const subject = await build()
        const noAmount = graphOf([
            branchOf({
                key: "kind",
                when: { fact: "supplier_payment.kind", op: "eq", value: "rent" },
                mode: "ask",
                next: "ask",
                approver: approverOf(),
            }),
            branchOf({ key: "else", when: "else", mode: "stop", next: "stop" }),
        ])

        expect(subject.graphGapsOf({ nodes: [nodeOf()] }, contextOf())).toEqual([])
        expect(subject.graphGapsOf(noAmount, contextOf())).toEqual([])
        expect(decideOf([]).decide?.branches).toEqual([])
    })
})
