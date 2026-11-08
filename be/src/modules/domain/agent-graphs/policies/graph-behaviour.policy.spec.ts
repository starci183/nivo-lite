import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, approverOf, branchOf, graphOf, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { sameBehaviour } from "./graph-behaviour.policy"

/** The members of the subject under test. */
interface Subject {
    readonly sameBehaviour: typeof sameBehaviour
}

const SUBJECT = Symbol("graph-behaviour.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sameBehaviour } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const BASE = graphOf(OWNER_EXAMPLE)

type Node = (typeof BASE.nodes)[number]

/** The graph with one node changed by the function. */
const withNode = (key: string, change: (node: Node) => Node) => ({
    ...BASE,
    nodes: BASE.nodes.map((node) => (node.key === key ? change(node) : node)),
})

describe("graph-behaviour.policy sameBehaviour", () => {
    it("holds a graph to be the same as itself and as a copy", async () => {
        const subject = await build()

        expect(subject.sameBehaviour(BASE, BASE)).toBe(true)
        expect(subject.sameBehaviour(BASE, graphOf(OWNER_EXAMPLE))).toBe(true)
    })

    it("leaves the words out: another title, description or source is not a change of what the agent does", async () => {
        const subject = await build()
        const reworded = withNode("decide", (node) =>
            nodeOf({ ...node, title: "Kiem tra", does: "Xem so tien", sources: [] }),
        )

        expect(subject.sameBehaviour(BASE, reworded)).toBe(true)
    })

    it.each([
        [
            "another outcome of a branch",
            graphOf([
                ...OWNER_EXAMPLE.slice(0, 2),
                branchOf({ key: "else", when: "else", outcome: "stop", next: "stop", approver: null }),
            ]),
        ],
        [
            "another condition",
            graphOf([
                branchOf({
                    key: "small",
                    when: { fact: "supplier_payment.amount_vnd", op: "lt", value: 6_000_000 },
                }),
                ...OWNER_EXAMPLE.slice(1),
            ]),
        ],
        ["fewer nodes", { ...BASE, nodes: BASE.nodes.slice(0, -1) }],
    ])("sees %s as another behaviour", async (_label, other) => {
        const subject = await build()

        expect(subject.sameBehaviour(BASE, other)).toBe(false)
    })

    it.each([
        ["the node it leads to", (node: Node) => nodeOf({ ...node, next: ["end", "act"] })],
        ["its step", (node: Node) => nodeOf({ ...node, step: "stop" })],
        ["its action", (node: Node) => nodeOf({ ...node, action: "send_quote" })],
        ["its pipeline", (node: Node) => nodeOf({ ...node, pipeline: "quote_flow" })],
        ["its approver", (node: Node) => nodeOf({ ...node, approver: approverOf() })],
    ])("sees a change of %s as another behaviour", async (_label, change) => {
        const subject = await build()

        expect(subject.sameBehaviour(BASE, withNode("act", change))).toBe(false)
        expect(subject.sameBehaviour(BASE, withNode("decide", change))).toBe(false)
    })
})

describe("graph-behaviour.policy sameBehaviour the decide point and the approvers", () => {
    it("sees a decide point taken away from a node, or given to one that had none, as another behaviour", async () => {
        const subject = await build()
        const taken = withNode("decide", (node) => nodeOf({ ...node, decide: undefined }))
        const given = withNode("act", (node) =>
            nodeOf({ ...node, decide: { intent: "pay_rent", facts: [], branches: [branchOf()] } }),
        )

        expect(subject.sameBehaviour(BASE, taken)).toBe(false)
        expect(subject.sameBehaviour(BASE, given)).toBe(false)
    })

    it("sees another approver of a branch, another fact list or another intent as another behaviour", async () => {
        const subject = await build()
        const otherApprover = graphOf(
            OWNER_EXAMPLE.map((branch) =>
                branch.key === "middle" ? { ...branch, approver: approverOf({ policy: "all" }) } : branch,
            ),
        )
        const otherFacts = withNode("decide", (node) =>
            nodeOf({ ...node, decide: node.decide === undefined ? undefined : { ...node.decide, facts: [] } }),
        )
        const otherIntent = withNode("decide", (node) =>
            nodeOf({ ...node, decide: node.decide === undefined ? undefined : { ...node.decide, intent: "pay_rent" } }),
        )

        expect(subject.sameBehaviour(BASE, otherApprover)).toBe(false)
        expect(subject.sameBehaviour(BASE, otherFacts)).toBe(false)
        expect(subject.sameBehaviour(BASE, otherIntent)).toBe(false)
    })
})
