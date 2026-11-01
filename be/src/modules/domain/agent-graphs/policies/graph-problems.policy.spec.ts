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
import type { CeilingRule, GraphDocument } from "../agent-graphs.contracts"
import { blankAnswers, ceilingProblems, graphProblems, rightsProblems, successorsOf } from "./graph-problems.policy"

/** The members of the subject under test. */
interface Subject {
    readonly graphProblems: typeof graphProblems
    readonly ceilingProblems: typeof ceilingProblems
    readonly rightsProblems: typeof rightsProblems
    readonly blankAnswers: typeof blankAnswers
    readonly successorsOf: typeof successorsOf
}

const SUBJECT = Symbol("graph-problems.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { graphProblems, ceilingProblems, rightsProblems, blankAnswers, successorsOf },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const codes = (problems: ReadonlyArray<{ readonly code: string }>): ReadonlyArray<string> =>
    problems.map((entry) => entry.code)

const OPEN_RULE: CeilingRule = {
    action: "pay_supplier",
    mode: "auto",
    limitVnd: null,
    autoMax: 20_000_000,
    maxMode: null,
}

describe("graph-problems.policy shape", () => {
    it("finds nothing wrong with the owner example", async () => {
        const subject = await build()

        expect(subject.graphProblems(graphOf(OWNER_EXAMPLE), contextOf())).toEqual([])
    })

    it("follows a decide node by its branches and any other node by its next", async () => {
        const subject = await build()

        expect(subject.successorsOf(decideOf(OWNER_EXAMPLE))).toEqual(["act", "ask", "ask"])
        expect(subject.successorsOf(nodeOf({ next: ["end"] }))).toEqual(["end"])
    })

    it("finds a cycle, a dead end and a node that leads nowhere", async () => {
        const subject = await build()
        const graph: GraphDocument = {
            nodes: [
                nodeOf({ key: "a", next: ["b"] }),
                nodeOf({ key: "b", next: ["a"] }),
                nodeOf({ key: "c", kind: "execute", step: "call", next: [] }),
                nodeOf({ key: "d", kind: "execute", step: "call", next: ["missing"] }),
            ],
            rights: [],
        }

        const problems = subject.graphProblems(graph, contextOf())

        expect(problems.filter((entry) => entry.code === "cycle").map((entry) => entry.nodeKey)).toEqual(["a", "b"])
        expect(problems.filter((entry) => entry.code === "dead_end").map((entry) => entry.nodeKey)).toEqual(["c", "d"])
    })

    it("refuses a graph of more than sixty nodes", async () => {
        const subject = await build()
        const nodes = Array.from({ length: 61 }, (_unused, index) =>
            nodeOf({ key: `n${index}`, kind: "output", step: "stop", next: [] }),
        )

        expect(codes(subject.graphProblems({ nodes, rights: [] }, contextOf()))).toContain("node_limit")
    })
})

describe("graph-problems.policy the three kinds", () => {
    it("wants a trigger to start the graph, and says so once for a graph with none", async () => {
        const subject = await build()
        const whole = graphOf(OWNER_EXAMPLE)
        const headless: GraphDocument = { ...whole, nodes: whole.nodes.filter((node) => node.kind !== "trigger") }

        expect(codes(subject.graphProblems(headless, contextOf()))).toEqual(["no_trigger", "not_from_trigger"])
    })

    it("names a node that nothing leads to when it is not a trigger, and lets a tag trigger start a flow of its own", async () => {
        const subject = await build()
        const whole = graphOf(OWNER_EXAMPLE)
        const tagged: GraphDocument = {
            ...whole,
            nodes: [...whole.nodes, nodeOf({ key: "tag", kind: "trigger", step: "tag", next: ["decide"] })],
        }
        const lost: GraphDocument = { ...whole, nodes: [...whole.nodes, nodeOf({ key: "lost", next: ["end"] })] }

        expect(subject.graphProblems(tagged, contextOf())).toEqual([])
        expect(subject.graphProblems(lost, contextOf())).toEqual([
            { code: "not_from_trigger", nodeKey: "lost", branchKey: null, detail: "" },
        ])
    })

    it("ends every path at an output: a trigger or an execute step that leads nowhere is a dead end", async () => {
        const subject = await build()
        const whole = graphOf(OWNER_EXAMPLE)
        const open: GraphDocument = {
            ...whole,
            nodes: whole.nodes
                .map((node) => (node.key === "act" ? { ...node, next: ["think", "end"] } : node))
                .concat(nodeOf({ key: "think", kind: "execute", step: "call", next: [] })),
        }

        expect(subject.graphProblems(open, contextOf())).toEqual([
            { code: "dead_end", nodeKey: "think", branchKey: null, detail: "" },
        ])
    })

    it("refuses a step that does not belong to its kind", async () => {
        const subject = await build()
        const whole = graphOf(OWNER_EXAMPLE)
        const odd: GraphDocument = {
            ...whole,
            nodes: whole.nodes.map((node) => (node.key === "start" ? { ...node, step: "write" } : node)),
        }

        expect(subject.graphProblems(odd, contextOf())).toContainEqual({
            code: "bad_step",
            nodeKey: "start",
            branchKey: null,
            detail: "write",
        })
    })
})

describe("graph-problems.policy conditions", () => {
    it("keeps the decide point on a condition node and nowhere else", async () => {
        const subject = await build()
        const whole = graphOf(OWNER_EXAMPLE)
        const asExecute: GraphDocument = {
            ...whole,
            nodes: whole.nodes.map((node) =>
                node.key === "decide" ? { ...node, kind: "execute", step: "call" } : node,
            ),
        }
        const stray: GraphDocument = {
            ...whole,
            nodes: whole.nodes.map((node) => (node.key === "act" ? { ...node, decide: decideOf([]).decide } : node)),
        }

        expect(subject.graphProblems(asExecute, contextOf())).toContainEqual({
            code: "bad_step",
            nodeKey: "decide",
            branchKey: null,
            detail: "decide",
        })
        expect(subject.graphProblems(stray, contextOf())).toContainEqual({
            code: "bad_step",
            nodeKey: "act",
            branchKey: null,
            detail: "decide",
        })
    })

    it("wants every branch to reach an output, even through steps in between", async () => {
        const subject = await build()
        const looping = graphOf([
            branchOf({ key: "small", when: amountIs("lt", 5_000_000), then: "auto", next: "spin" }),
            branchOf({ key: "else", when: "else", then: "ask", next: "ask", approver: approverOf() }),
        ])
        const withLoop: GraphDocument = {
            ...looping,
            nodes: [...looping.nodes, nodeOf({ key: "spin", kind: "execute", step: "call", next: ["spin"] })],
        }

        const found = subject.graphProblems(withLoop, contextOf())

        expect(found).toContainEqual({ code: "branch_no_output", nodeKey: "decide", branchKey: "small", detail: "" })
        expect(found.filter((entry) => entry.code === "branch_no_output")).toHaveLength(1)
        expect(codes(subject.graphProblems(graphOf(OWNER_EXAMPLE), contextOf()))).not.toContain("branch_no_output")
    })
})

describe("graph-problems.policy decide points", () => {
    it("asks for an else, and refuses an else that runs alone", async () => {
        const subject = await build()
        const noElse = graphOf([branchOf({ key: "all", when: { fact: AMOUNT_FACT, op: "known" } })])
        const autoElse = graphOf([branchOf({ key: "else", when: "else", then: "auto" })])

        expect(codes(subject.graphProblems(noElse, contextOf()))).toContain("no_else")
        expect(codes(subject.graphProblems(autoElse, contextOf()))).toContain("else_auto")
    })

    it("names a gap at the exact bound and an overlap", async () => {
        const subject = await build()
        const gap = graphOf([
            branchOf({ key: "under", when: amountIs("lt", 5_000_000) }),
            branchOf({ key: "above", when: amountIs("gt", 5_000_000), then: "stop", next: "stop" }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])
        const overlap = graphOf([
            branchOf({ key: "up", when: amountIs("lte", 5_000_000) }),
            branchOf({ key: "from", when: amountIs("gte", 5_000_000), then: "stop", next: "stop" }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])

        expect(codes(subject.graphProblems(gap, contextOf()))).toEqual(["gap"])
        expect(codes(subject.graphProblems(overlap, contextOf()))).toEqual(["overlap"])
    })

    it("names a condition that does not fit its fact", async () => {
        const subject = await build()
        const graph = graphOf([
            branchOf({ key: "bad", when: { fact: "nothing", op: "known" } }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])

        expect(subject.graphProblems(graph, contextOf())).toContainEqual({
            code: "bad_condition",
            nodeKey: "decide",
            branchKey: "bad",
            detail: "unknown_fact:nothing",
        })
    })
})

describe("graph-problems.policy decide points (continued)", () => {
    it("needs an approver on an ask, a timeout that is set, and an approver with a grant", async () => {
        const subject = await build()
        const missing = graphOf([branchOf({ key: "else", when: "else", then: "ask", next: "ask", approver: null })])
        const unset = graphOf([
            branchOf({
                key: "else",
                when: "else",
                then: "ask",
                next: "ask",
                approver: approverOf({ onTimeout: { kind: "unset" } }),
            }),
        ])
        const asking = graphOf([
            branchOf({ key: "else", when: "else", then: "ask", next: "ask", approver: approverOf() }),
        ])

        expect(codes(subject.graphProblems(missing, contextOf()))).toEqual(["approver_missing"])
        expect(codes(subject.graphProblems(unset, contextOf()))).toEqual(["on_timeout_unset"])
        expect(codes(subject.graphProblems(asking, contextOf({ approverCovers: () => false })))).toEqual([
            "approver_no_grant",
        ])
    })

    it("asks the approver to cover the top of the range of the branch", async () => {
        const subject = await build()
        const tops: Array<number | null> = []
        const graph = graphOf(OWNER_EXAMPLE)

        subject.graphProblems(
            graph,
            contextOf({
                approverCovers: (_action, _group, top) => {
                    tops.push(top)
                    return true
                },
            }),
        )

        expect(tops).toEqual([20_000_000, null])
    })

    it("treats a branch with no amount to place as having no top", async () => {
        const subject = await build()
        const graph = graphOf([
            branchOf({
                key: "kind",
                when: { fact: "supplier_payment.kind", op: "eq", value: "rent" },
                then: "ask",
                next: "ask",
                approver: approverOf(),
            }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])
        const tops: Array<number | null> = []

        subject.graphProblems(
            graph,
            contextOf({
                approverCovers: (_action, _group, top) => {
                    tops.push(top)
                    return true
                },
            }),
        )

        expect(tops).toEqual([null])
    })
})

describe("graph-problems.policy without a fact counted in dong", () => {
    it("asks the approver to cover no top at all, as no branch can be placed on an amount", async () => {
        const subject = await build()
        const tops: Array<number | null> = []

        subject.graphProblems(
            graphOf(OWNER_EXAMPLE),
            contextOf({
                facts: {},
                approverCovers: (_action, _group, top) => {
                    tops.push(top)
                    return true
                },
            }),
        )

        expect(tops).toEqual([null, null])
    })
})

describe("graph-problems.policy ceilingProblems", () => {
    it("lets a branch run alone inside the rule and refuses one that reaches past it", async () => {
        const subject = await build()
        const inside = graphOf([
            branchOf({ key: "small", when: amountIs("lte", 20_000_000) }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])
        const past = graphOf([
            branchOf({ key: "small", when: amountIs("lt", 25_000_000) }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])
        const unbounded = graphOf([
            branchOf({ key: "small", when: { fact: AMOUNT_FACT, op: "known" } }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])
        const context = contextOf({ ceilings: [OPEN_RULE] })

        expect(subject.ceilingProblems(inside, context)).toEqual([])
        expect(codes(subject.ceilingProblems(past, context))).toEqual(["ceiling"])
        expect(codes(subject.ceilingProblems(unbounded, context))).toEqual(["ceiling"])
    })

    it("holds a branch that runs alone to the strict limit of an old rule", async () => {
        const subject = await build()
        const limit = contextOf({ ceilings: [{ ...OPEN_RULE, autoMax: null, limitVnd: 5_000_000 }] })
        const strict = graphOf([branchOf({ key: "small", when: amountIs("lt", 5_000_000) })])
        const touching = graphOf([branchOf({ key: "small", when: amountIs("lte", 5_000_000) })])
        const beyond = graphOf([branchOf({ key: "small", when: amountIs("lt", 6_000_000) })])
        const open = graphOf([branchOf({ key: "small", when: { fact: AMOUNT_FACT, op: "known" } })])

        expect(subject.ceilingProblems(strict, limit)).toEqual([])
        expect(codes(subject.ceilingProblems(touching, limit))).toEqual(["ceiling"])
        expect(codes(subject.ceilingProblems(beyond, limit))).toEqual(["ceiling"])
        expect(codes(subject.ceilingProblems(open, limit))).toEqual(["ceiling"])
    })
})

describe("graph-problems.policy ceilingProblems (continued)", () => {
    it("lets a rule with no limit at all leave the branch free", async () => {
        const subject = await build()
        const free = contextOf({ ceilings: [{ ...OPEN_RULE, autoMax: null, limitVnd: null }] })

        expect(
            subject.ceilingProblems(
                graphOf([branchOf({ key: "small", when: { fact: AMOUNT_FACT, op: "known" } })]),
                free,
            ),
        ).toEqual([])
    })

    it("refuses any branch that runs alone where the rule asks, never allows or the action is capped", async () => {
        const subject = await build()
        const graph = graphOf([branchOf({ key: "small", when: amountIs("lt", 1) })])

        expect(codes(subject.ceilingProblems(graph, contextOf({ ceilings: [{ ...OPEN_RULE, mode: "ask" }] })))).toEqual(
            ["ceiling"],
        )
        expect(
            codes(subject.ceilingProblems(graph, contextOf({ ceilings: [{ ...OPEN_RULE, mode: "never" }] }))),
        ).toEqual(["ceiling"])
        expect(
            codes(subject.ceilingProblems(graph, contextOf({ ceilings: [{ ...OPEN_RULE, maxMode: "ask" }] }))),
        ).toEqual(["ceiling"])
    })

    it("does not judge a branch that asks or stops, an else, or an action with no rule", async () => {
        const subject = await build()
        const graph = graphOf([
            branchOf({
                key: "ask",
                when: amountIs("lt", 99_000_000),
                then: "ask",
                next: "ask",
                approver: approverOf(),
            }),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop" }),
        ])

        expect(subject.ceilingProblems(graph, contextOf({ ceilings: [{ ...OPEN_RULE, mode: "never" }] }))).toEqual([])
        expect(subject.ceilingProblems(graph, contextOf({ ceilings: [{ ...OPEN_RULE, action: "other" }] }))).toEqual([])
        expect(
            subject.ceilingProblems({ nodes: [nodeOf()], rights: [] }, contextOf({ ceilings: [OPEN_RULE] })),
        ).toEqual([])
    })
})

describe("graph-problems.policy rightsProblems", () => {
    const using = (tool: string | null, placeholder = false): GraphDocument => ({
        nodes: [nodeOf({ uses: [{ provider: "sepay", tool, scope: "read", label: "SePay", placeholder }], next: [] })],
        rights: [],
    })

    it("names a tool the agent holds no grant on, a placeholder drawn live and data read without a right", async () => {
        const subject = await build()
        const denied = contextOf({ isGranted: () => false })

        expect(codes(subject.rightsProblems(using("sepay.status"), denied))).toEqual(["no_right", "no_data_right"])
        expect(codes(subject.rightsProblems(using("sepay.status"), contextOf()))).toEqual(["no_data_right"])
        expect(codes(subject.rightsProblems(using("zalo.send", true), contextOf()))).toEqual([
            "placeholder_live",
            "no_data_right",
        ])
        expect(subject.rightsProblems(using(null, true), denied)).toMatchObject([
            { code: "placeholder_live", detail: "SePay" },
        ])
        expect(subject.rightsProblems(using(null), denied)).toEqual([])
        expect(subject.rightsProblems(using("office.note"), contextOf())).toEqual([])
    })

    it("accepts data the graph holds a right on", async () => {
        const subject = await build()
        const graph: GraphDocument = {
            ...using("sepay.status"),
            rights: [{ kind: "payments", scope: "workspace", hide: [], mask: [] }],
        }

        expect(subject.rightsProblems(graph, contextOf())).toEqual([])
    })

    it("keeps a graph that faces customers narrow", async () => {
        const subject = await build()
        const wide: GraphDocument = {
            nodes: [],
            rights: [
                { kind: "customers", scope: "workspace", hide: [], mask: [] },
                { kind: "brain", scope: "conversation", hide: [], mask: [] },
            ],
        }

        expect(subject.graphProblems(wide, contextOf({ facesCustomers: true }))).toEqual([
            { code: "outsider_wide", nodeKey: "", branchKey: null, detail: "customers" },
        ])
        expect(subject.graphProblems(wide, contextOf())).toEqual([])
    })
})

describe("graph-problems.policy blank answers", () => {
    it("refuses a blank title, a blank sentence, a title or sentence too long, an empty list not marked none and an approval with nobody", async () => {
        const subject = await build()
        const marked = nodeOf({ none: ["uses"] })

        expect(subject.blankAnswers(marked)).toEqual([])
        expect(subject.blankAnswers(nodeOf({ title: "  " }))).toEqual(["title"])
        expect(subject.blankAnswers(nodeOf({ title: "x".repeat(29) }))).toEqual(["title"])
        expect(subject.blankAnswers(nodeOf({ does: "" }))).toEqual(["does"])
        expect(subject.blankAnswers(nodeOf({ does: "x".repeat(201) }))).toEqual(["does"])
        expect(subject.blankAnswers(nodeOf({ none: [] }))).toEqual(["uses"])
        expect(
            subject.blankAnswers(
                nodeOf({
                    knows: [],
                    reads: [],
                    writes: [],
                    sources: [],
                    none: ["uses", "knows", "reads", "writes", "sources"],
                }),
            ),
        ).toEqual([])
        expect(subject.blankAnswers(nodeOf({ step: "approval", approver: null }))).toEqual(["approver"])
        expect(
            codes(subject.graphProblems({ nodes: [nodeOf({ does: "", next: [] })], rights: [] }, contextOf())),
        ).toContain("blank_answer")
    })
})
