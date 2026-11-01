import { Test } from "@nestjs/testing"
import {
    AMOUNT_FACT,
    OWNER_EXAMPLE,
    amountIs,
    approverOf,
    branchOf,
    graphOf,
    nodeOf,
} from "@tests/fixtures/builders/agent-graph.builder"
import type { DataRight } from "@modules/domain/mcp-gateway"
import type { FactRegistry, GraphBranch, GraphDocument } from "../agent-graphs.contracts"
import { graphDiff } from "./graph-diff.policy"

/** The members of the subject under test. */
interface Subject {
    readonly graphDiff: typeof graphDiff
}

const SUBJECT = Symbol("graph-diff.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { graphDiff } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const FACTS: FactRegistry = { [AMOUNT_FACT]: { key: AMOUNT_FACT, type: "number", unit: "vnd", labelKey: "fact" } }
const BY = { actorMemberId: "boss", facts: FACTS }
const BASE = graphOf(OWNER_EXAMPLE)

const withBranches = (branches: ReadonlyArray<GraphBranch>): GraphDocument => graphOf(branches)
const kinds = (diff: ReturnType<typeof graphDiff>): ReadonlyArray<string> => diff.changes.map((entry) => entry.kind)
const RIGHT: DataRight = { kind: "payments", scope: "conversation", hide: ["cost"], mask: ["phone"] }
const withRights = (rights: ReadonlyArray<DataRight>): GraphDocument => ({ ...BASE, rights })

describe("graph-diff.policy", () => {
    it("finds no widening in a graph that did not change", async () => {
        const subject = await build()

        expect(subject.graphDiff(BASE, BASE, BY)).toEqual({ widens: false, changes: [] })
    })

    it("counts a raised boundary as a widening", async () => {
        const subject = await build()
        const raised = withBranches([
            branchOf({ key: "small", when: amountIs("lt", 6_000_000), then: "auto", next: "act" }),
            ...OWNER_EXAMPLE.slice(1),
        ])

        expect(kinds(subject.graphDiff(BASE, raised, BY))).toEqual(["boundary_raised"])
        expect(subject.graphDiff(BASE, raised, BY).widens).toBe(true)
    })

    it("counts a boundary that became unbounded as a raise", async () => {
        const subject = await build()
        const free = withBranches([
            branchOf({ key: "small", when: { fact: AMOUNT_FACT, op: "known" }, then: "auto", next: "act" }),
            ...OWNER_EXAMPLE.slice(1),
        ])

        expect(kinds(subject.graphDiff(BASE, free, BY))).toEqual(["boundary_raised"])
    })

    it("does not count a lowered boundary or a branch that now asks as a widening", async () => {
        const subject = await build()
        const lowered = withBranches([
            branchOf({ key: "small", when: amountIs("lt", 4_000_000), then: "auto", next: "act" }),
            ...OWNER_EXAMPLE.slice(1),
        ])
        const asking = withBranches([
            branchOf({
                key: "small",
                when: amountIs("lt", 5_000_000),
                then: "ask",
                next: "ask",
                approver: approverOf(),
            }),
            ...OWNER_EXAMPLE.slice(1),
        ])

        expect(subject.graphDiff(BASE, lowered, BY)).toEqual({ widens: false, changes: [] })
        expect(subject.graphDiff(BASE, asking, BY)).toEqual({ widens: false, changes: [] })
    })
})

describe("graph-diff.policy (continued)", () => {
    it("counts a branch that went from asking to running alone, and a new branch that runs alone", async () => {
        const subject = await build()
        const nowAuto = withBranches([
            OWNER_EXAMPLE[0] ?? branchOf(),
            branchOf({ ...OWNER_EXAMPLE[1], then: "auto", approver: null }),
            OWNER_EXAMPLE[2] ?? branchOf(),
        ])
        const extra = withBranches([
            ...OWNER_EXAMPLE,
            branchOf({ key: "extra", when: amountIs("lt", 1), then: "auto" }),
        ])

        expect(kinds(subject.graphDiff(BASE, nowAuto, BY))).toEqual(["branch_more_auto"])
        expect(kinds(subject.graphDiff(BASE, extra, BY))).toEqual(["branch_more_auto"])
    })

    it("counts naming yourself as an approver as a widening, once", async () => {
        const subject = await build()
        const self = withBranches([
            ...OWNER_EXAMPLE.slice(0, 2),
            branchOf({
                key: "else",
                when: "else",
                then: "ask",
                next: "ask",
                approver: approverOf({ group: { roles: [], rooms: [], members: ["boss"] } }),
            }),
        ])

        expect(kinds(subject.graphDiff(BASE, self, BY))).toEqual(["self_approver"])
        expect(subject.graphDiff(self, self, BY).widens).toBe(false)
        expect(subject.graphDiff(BASE, self, { ...BY, actorMemberId: null }).widens).toBe(false)
    })
})

describe("graph-diff.policy tools and rights", () => {
    it("counts a tool that was not there before, once", async () => {
        const subject = await build()
        const tool = { provider: "sepay", tool: "sepay.status", scope: "read", label: "SePay" } as const
        const added: GraphDocument = {
            ...BASE,
            nodes: [...BASE.nodes, nodeOf({ key: "extra", uses: [tool], next: ["end"] })],
        }
        const knownTool: GraphDocument = {
            ...BASE,
            nodes: [
                ...BASE.nodes.filter((node) => node.key !== "act"),
                nodeOf({ key: "act", uses: [tool], next: ["end"] }),
            ],
        }

        expect(kinds(subject.graphDiff(BASE, added, BY))).toEqual(["tool_added"])
        expect(subject.graphDiff(knownTool, knownTool, BY).widens).toBe(false)
        expect(
            subject.graphDiff(
                added,
                {
                    ...added,
                    nodes: [...added.nodes, nodeOf({ key: "bare", uses: [{ ...tool, tool: null }], next: ["end"] })],
                },
                BY,
            ).widens,
        ).toBe(false)
    })

    it("counts a data right that was added or widened, and not one that was narrowed or kept", async () => {
        const subject = await build()
        const held = withRights([RIGHT])

        expect(kinds(subject.graphDiff(BASE, held, BY))).toEqual(["right_added"])
        expect(kinds(subject.graphDiff(held, withRights([{ ...RIGHT, scope: "workspace" }]), BY))).toEqual([
            "right_widened",
        ])
        expect(kinds(subject.graphDiff(held, withRights([{ ...RIGHT, hide: [] }]), BY))).toEqual(["right_widened"])
        expect(kinds(subject.graphDiff(held, withRights([{ ...RIGHT, mask: [] }]), BY))).toEqual(["right_widened"])
        expect(subject.graphDiff(held, withRights([{ ...RIGHT, mask: [], hide: ["cost", "phone"] }]), BY).widens).toBe(
            false,
        )
        expect(subject.graphDiff(withRights([{ ...RIGHT, scope: "workspace" }]), held, BY).widens).toBe(false)
        expect(subject.graphDiff(held, held, BY).widens).toBe(false)
    })
})
