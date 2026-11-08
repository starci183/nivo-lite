import { Test } from "@nestjs/testing"
import {
    AMOUNT_FACT,
    FACTS,
    OWNER_EXAMPLE,
    amountIs,
    approverOf,
    branchOf,
    decideOf,
    graphOf,
} from "@tests/fixtures/builders/agent-graph.builder"
import {
    ACT,
    AMOUNT,
    ASK,
    PAY,
    STOP,
    TRIGGER,
    URGENT,
    documentOf,
    stepOf,
} from "@tests/fixtures/builders/agent-graph-walk.builder"
import type { Node } from "@tests/fixtures/builders/agent-graph-walk.builder"
import { factsOfWalk, walkGraph } from "./graph-walk.policy"

/** The members of the subject under test. */
interface Subject {
    readonly factsOfWalk: typeof factsOfWalk
    readonly walkGraph: typeof walkGraph
}

const SUBJECT = Symbol("graph-walk.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { factsOfWalk, walkGraph } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("graph-walk.policy walkGraph entering the graph", () => {
    it("enters at the decide point of the action and runs when the branch lets it", async () => {
        const subject = await build()

        expect(subject.walkGraph(graphOf(OWNER_EXAMPLE), PAY, { [AMOUNT_FACT]: 1_000_000 }, FACTS)).toMatchObject({
            outcome: "run",
            path: ["decide", "act"],
            branchKey: "small",
            approver: null,
            divert: null,
            unread: [],
            unjudged: null,
        })
    })

    it("asks the approver of the branch, through the approval node, and names the branch that asked", async () => {
        const subject = await build()

        expect(subject.walkGraph(graphOf(OWNER_EXAMPLE), PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "ask",
            path: ["decide", "ask", "act"],
            branchKey: "middle",
            approver: approverOf(),
            divert: null,
            unread: [],
            unjudged: null,
        })
    })

    it("asks the approver of the approval node when the branch names none", async () => {
        const subject = await build()
        const document = graphOf([
            branchOf({ key: "small", when: amountIs("lt", 5_000_000) }),
            branchOf({ key: "else", when: "else", outcome: "ask", next: "ask", approver: null }),
        ])

        expect(subject.walkGraph(document, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "ask",
            branchKey: "else",
            approver: approverOf(),
        })
    })

    it("stops at a branch that stops, with nothing left to ask", async () => {
        const subject = await build()
        const document = graphOf([
            ...OWNER_EXAMPLE.slice(0, 2),
            branchOf({ key: "else", when: "else", outcome: "stop", next: "stop", approver: null }),
        ])

        expect(subject.walkGraph(document, PAY, { [AMOUNT_FACT]: 30_000_000 }, FACTS)).toMatchObject({
            outcome: "stop",
            path: ["decide"],
            branchKey: "else",
            approver: null,
            divert: null,
            unread: [],
            unjudged: null,
        })
    })

    it("stops at a stop node the path reaches", async () => {
        const subject = await build()
        const direct = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "stop" })]),
            STOP,
        )

        expect(subject.walkGraph(direct, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "stop",
            path: ["decide", "stop"],
            branchKey: "big",
        })
    })
})

describe("graph-walk.policy walkGraph entering the graph at an approval, an act or a stop", () => {
    it("enters at the approval that leads to the act when no decide point holds the action", async () => {
        const subject = await build()
        const document = documentOf(TRIGGER, stepOf("understand", "read_context", ["ask"]), ASK, ACT)

        expect(subject.walkGraph(document, PAY, {}, FACTS)).toMatchObject({
            outcome: "ask",
            path: ["ask", "act"],
            branchKey: "ask",
            approver: approverOf(),
            divert: null,
            unread: [],
            unjudged: null,
        })
    })

    it("enters at the act when nothing stands before it, and runs", async () => {
        const subject = await build()

        expect(subject.walkGraph(documentOf(TRIGGER, ACT), PAY, {}, FACTS)).toMatchObject({
            outcome: "run",
            path: ["act"],
            branchKey: "act",
        })
    })

    it("enters at the stop a closed rule cited for the action, and stops", async () => {
        const subject = await build()
        const closed = stepOf("stop:pay", "stop", [], { sources: [{ kind: "rule", action: PAY }] })
        const elsewhere = stepOf("stop:other", "stop", [], { sources: [{ kind: "rule", action: "send_quote" }] })
        const unrelated = stepOf("stop:brain", "stop", [], {
            sources: [{ kind: "brain", factId: "f1", passage: "x", valueHash: "h" }],
        })

        expect(subject.walkGraph(documentOf(TRIGGER, unrelated, elsewhere, closed), PAY, {}, FACTS)).toMatchObject({
            outcome: "stop",
            path: ["stop:pay"],
            branchKey: "stop:pay",
        })
        expect(subject.walkGraph(documentOf(TRIGGER, unrelated, elsewhere), PAY, {}, FACTS)).toMatchObject({
            outcome: "unheld",
        })
    })

    it("says the graph holds nothing of an action no node holds, and judges nothing", async () => {
        const subject = await build()

        expect(subject.walkGraph(graphOf(OWNER_EXAMPLE), "send_quote", AMOUNT, FACTS)).toMatchObject({
            outcome: "unheld",
            path: [],
            unjudged: "not_in_graph",
        })
    })

    it("reads only the decide point on a road that a decide point alone judges", async () => {
        const subject = await build()
        const withApproval = documentOf(TRIGGER, ASK, ACT)

        expect(subject.walkGraph(withApproval, PAY, {}, FACTS, { decideOnly: true })).toMatchObject({
            outcome: "unheld",
        })
        expect(subject.walkGraph(graphOf(OWNER_EXAMPLE), PAY, AMOUNT, FACTS, { decideOnly: true })).toMatchObject({
            outcome: "ask",
            branchKey: "middle",
        })
    })
})

describe("graph-walk.policy walkGraph the act of another action", () => {
    const HAND = stepOf("hand", "write", [], { action: "hand_over_conversation", handoverTo: "support" })

    it("diverts to the hand-over the graph names, with its own target", async () => {
        const subject = await build()
        const direct = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "hand" })]),
            HAND,
        )
        expect(subject.walkGraph(direct, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "divert",
            path: ["decide", "hand"],
            branchKey: "big",
            approver: null,
            divert: { action: "hand_over_conversation", handoverTo: "support", asks: false },
            unread: [],
            unjudged: null,
        })
    })

    it("diverts with the ask when the path went through an approval, and without a target the node does not name", async () => {
        const subject = await build()
        const bare = stepOf("hand", "write", [], { action: "hand_over_conversation" })
        const document = documentOf(
            TRIGGER,
            decideOf([
                branchOf({ key: "big", when: amountIs("gt", 1), outcome: "ask", next: "ask", approver: approverOf() }),
            ]),
            stepOf("ask", "approval", ["hand"], { approver: approverOf() }),
            bare,
        )

        expect(subject.walkGraph(document, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "divert",
            path: ["decide", "ask", "hand"],
            approver: approverOf(),
            divert: { action: "hand_over_conversation", handoverTo: null, asks: true },
        })
    })

    it("takes a reply node for the action reply_customer, whatever the node names", async () => {
        const subject = await build()
        const reply = stepOf("reply", "reply", [])
        const document = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "reply" })]),
            reply,
        )

        expect(subject.walkGraph(documentOf(TRIGGER, reply), "reply_customer", {}, FACTS)).toMatchObject({
            outcome: "run",
            path: ["reply"],
        })
        expect(subject.walkGraph(document, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "divert",
            divert: { action: "reply_customer", handoverTo: null, asks: false },
        })
    })
})

describe("graph-walk.policy walkGraph pipelines and writes that name no action", () => {
    it("runs a node that carries a pipeline as the end of the path, and passes a write that names no action", async () => {
        const subject = await build()
        const piped = stepOf("piped", "write", [], { action: "send_quote", pipeline: "quote_flow" })
        const unnamed = stepOf("unnamed", "write", ["act"])
        const viaPipeline = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "piped" })]),
            piped,
        )
        const viaUnnamed = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "unnamed" })]),
            unnamed,
            ACT,
        )

        expect(subject.walkGraph(viaPipeline, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "run",
            path: ["decide", "piped"],
        })
        expect(subject.walkGraph(viaUnnamed, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "run",
            path: ["decide", "unnamed", "act"],
        })
    })
})

describe("graph-walk.policy walkGraph the safe branch", () => {
    it("takes the else for a fact it could not read, names the fact, and never runs alone", async () => {
        const subject = await build()
        const document = graphOf([
            branchOf({ key: "small", when: amountIs("lt", 5_000_000) }),
            branchOf({ key: "else", when: "else", outcome: "auto", next: "act" }),
        ])

        expect(subject.walkGraph(document, PAY, {}, FACTS)).toMatchObject({
            outcome: "ask",
            path: ["decide", "act"],
            branchKey: "else",
            approver: null,
            divert: null,
            unread: [AMOUNT_FACT],
            unjudged: "fact_unread",
        })
    })

    it("asks, saying there is no else, when no branch matches and none is left", async () => {
        const subject = await build()
        const document = graphOf([branchOf({ key: "small", when: amountIs("lt", 5_000_000) })])

        expect(subject.walkGraph(document, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "ask",
            path: ["decide"],
            branchKey: "decide",
            unjudged: "no_else",
        })
    })
})

describe("graph-walk.policy walkGraph the safe branch when the path is lost", () => {
    it("asks, saying there is no route, when the path leads nowhere", async () => {
        const subject = await build()
        const dead = stepOf("dead", "call", [])
        const missing = stepOf("missing", "call", ["nowhere"])
        const lost = (next: string) =>
            documentOf(
                TRIGGER,
                decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next })]),
                dead,
                missing,
                ACT,
            )

        expect(subject.walkGraph(lost("dead"), PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "ask",
            path: ["decide", "dead"],
            unjudged: "no_route",
        })
        expect(subject.walkGraph(lost("missing"), PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "ask",
            path: ["decide", "missing"],
            unjudged: "no_route",
        })
    })

    it("asks, saying there is no route, when the path goes round in a circle", async () => {
        const subject = await build()
        const there = stepOf("there", "call", ["back"])
        const back = stepOf("back", "call", ["there"])
        const document = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "there" })]),
            there,
            back,
            ACT,
        )

        expect(subject.walkGraph(document, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "ask",
            path: ["decide", "there", "back"],
            unjudged: "no_route",
        })
    })

    it("keeps the first reason when the path is lost after a fact could not be read", async () => {
        const subject = await build()
        const dead = stepOf("dead", "call", [])
        const document = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "else", when: "else", outcome: "auto", next: "dead" })]),
            dead,
            ACT,
        )

        expect(subject.walkGraph(document, PAY, {}, FACTS)).toMatchObject({
            outcome: "ask",
            unread: [AMOUNT_FACT],
            unjudged: "fact_unread",
        })
    })
})

describe("graph-walk.policy walkGraph a path of several steps", () => {
    const SECOND = decideOf([
        branchOf({ key: "urgent", when: { fact: URGENT, op: "eq", value: true }, outcome: "stop", next: "stop" }),
        branchOf({ key: "later", when: { fact: URGENT, op: "eq", value: false }, outcome: "auto", next: "act" }),
        branchOf({ key: "else", when: "else", outcome: "ask", next: "act" }),
    ])
    const chained = documentOf(
        TRIGGER,
        decideOf([
            branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "second" }),
            branchOf({ key: "else", when: "else", outcome: "ask", next: "second" }),
        ]),
        {
            ...SECOND,
            key: "second",
            decide:
                SECOND.decide === undefined
                    ? undefined
                    : { ...SECOND.decide, intent: "check_urgency", facts: [URGENT] },
        },
        STOP,
        ACT,
    )

    it("goes from one decide point to the next, each reading its own facts", async () => {
        const subject = await build()

        expect(subject.walkGraph(chained, PAY, { ...AMOUNT, [URGENT]: true }, FACTS)).toMatchObject({
            outcome: "stop",
            path: ["decide", "second"],
            branchKey: "urgent",
        })
        expect(subject.walkGraph(chained, PAY, { ...AMOUNT, [URGENT]: false }, FACTS)).toMatchObject({
            outcome: "run",
            path: ["decide", "second", "act"],
            branchKey: "later",
        })
    })

    it("lists each fact that could not be read once, over every decide point of the path", async () => {
        const subject = await build()

        expect(subject.walkGraph(chained, PAY, {}, FACTS)).toMatchObject({
            outcome: "ask",
            unread: [AMOUNT_FACT, URGENT],
            unjudged: "fact_unread",
        })
    })
})

describe("graph-walk.policy walkGraph approvals and forks on the path", () => {
    it("asks when the path went through an approval, even one that came after the branch ran alone", async () => {
        const subject = await build()
        const document = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "ask" })]),
            ASK,
            ACT,
        )

        expect(subject.walkGraph(document, PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "ask",
            path: ["decide", "ask", "act"],
            approver: approverOf(),
        })
    })

    it("follows the one way that can still reach the act of the action where a node has several", async () => {
        const subject = await build()
        const fork = stepOf("fork", "call", ["dead", "act"])
        const blind = stepOf("blind", "call", ["dead"])
        const through = (middle: Node) =>
            documentOf(
                TRIGGER,
                decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: middle.key })]),
                middle,
                stepOf("dead", "call", []),
                ACT,
            )

        expect(subject.walkGraph(through(fork), PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "run",
            path: ["decide", "fork", "act"],
        })
        expect(subject.walkGraph(through(blind), PAY, AMOUNT, FACTS)).toMatchObject({
            outcome: "ask",
            unjudged: "no_route",
        })
        expect(subject.walkGraph(through(stepOf("fork", "call", ["dead", "other"])), PAY, AMOUNT, FACTS)).toMatchObject(
            {
                unjudged: "no_route",
            },
        )
    })
})

describe("graph-walk.policy factsOfWalk", () => {
    it("lists the facts of every decide point the action can reach, once each", async () => {
        const subject = await build()
        const SECOND = decideOf([branchOf({ key: "else", when: "else", outcome: "auto", next: "act" })])
        const document = documentOf(
            TRIGGER,
            decideOf([branchOf({ key: "big", when: amountIs("gt", 1), outcome: "auto", next: "second" })]),
            {
                ...SECOND,
                key: "second",
                decide:
                    SECOND.decide === undefined
                        ? undefined
                        : { ...SECOND.decide, intent: "check", facts: [URGENT, AMOUNT_FACT] },
            },
            ACT,
        )

        expect(subject.factsOfWalk(document, PAY)).toEqual([AMOUNT_FACT, URGENT])
    })

    it("lists the facts of the decide point beyond an approval, and none for an action the graph does not hold", async () => {
        const subject = await build()

        expect(subject.factsOfWalk(graphOf(OWNER_EXAMPLE), PAY)).toEqual([AMOUNT_FACT])
        expect(subject.factsOfWalk(graphOf(OWNER_EXAMPLE), "send_quote")).toEqual([])
        expect(subject.factsOfWalk(documentOf(TRIGGER, ASK, ACT), PAY, { decideOnly: true })).toEqual([])
        expect(subject.factsOfWalk(documentOf(TRIGGER, ASK, ACT), PAY)).toEqual([])
    })
})
