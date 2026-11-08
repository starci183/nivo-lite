import { Test } from "@nestjs/testing"
import { END, TRIGGER, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { STEPS_OF_KIND, kindOfStep } from "../agent-graphs.contracts"
import type { GraphDocument, GraphNode, GraphNodeStep } from "../agent-graphs.contracts"
import { INTENT_OF_STEP, eventTypesOf, heldIntents, intentOfNode, reachableIntents } from "./intent-of-step.policy"

const SUBJECT = Symbol("intent-of-step.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { eventTypesOf, intentOfNode, heldIntents, reachableIntents } }],
    }).compile()
    return moduleRef.get<{
        eventTypesOf: typeof eventTypesOf
        intentOfNode: typeof intentOfNode
        heldIntents: typeof heldIntents
        reachableIntents: typeof reachableIntents
    }>(SUBJECT)
}

const stepNode = (step: GraphNodeStep, patch: Partial<GraphNode> = {}): GraphNode =>
    nodeOf({ key: step, kind: kindOfStep(step), step, ...patch })

/** A tag and a customer message, each leading to a node that yields an intent, and a decide point between. */
const GRAPH: GraphDocument = {
    nodes: [
        nodeOf({ key: "msg", kind: "trigger", step: "customer_message", title: "Message", next: ["answer"] }),
        nodeOf({ key: "tag", kind: "trigger", step: "tag", title: "Tag", next: ["understand"] }),
        nodeOf({ key: "answer", step: "write", action: "reply_customer", title: "Answer", next: ["end"] }),
        nodeOf({ key: "understand", kind: "execute", step: "call", title: "Understand", next: ["quote", "gate"] }),
        nodeOf({ key: "quote", step: "write", action: "send_quote", title: "Quote", next: ["end"] }),
        nodeOf({
            key: "gate",
            kind: "condition",
            step: "evaluate",
            title: "Gate",
            next: [],
            decide: {
                intent: "give_discount",
                facts: [],
                branches: [{ key: "a", when: "else", outcome: "ask", next: "discount", approver: null, sources: [] }],
            },
        }),
        nodeOf({ key: "discount", step: "write", action: "give_discount", title: "Discount", next: ["end"] }),
        nodeOf({ key: "lost", step: "write", action: "adjust_stock", title: "Lost", next: ["end"] }),
        END,
    ],
    rights: [],
}

describe("INTENT_OF_STEP", () => {
    it("has an entry for every step of every kind, so a new node type is one entry", () => {
        const steps = Object.values(STEPS_OF_KIND).flat()

        expect(Object.keys(INTENT_OF_STEP).sort()).toEqual([...steps].sort())
    })

    it("yields an intent from a write, a call and a reply, and none from the rest", async () => {
        const subject = await build()

        expect(subject.intentOfNode(stepNode("write", { action: "send_quote" }))).toBe("send_quote")
        expect(subject.intentOfNode(stepNode("write", { action: undefined }))).toBeNull()
        expect(subject.intentOfNode(stepNode("call", { action: "gateway_call" }))).toBe("gateway_call")
        expect(subject.intentOfNode(stepNode("call"))).toBeNull()
        expect(subject.intentOfNode(stepNode("reply"))).toBeNull()
        expect(subject.intentOfNode(stepNode("reply", { action: "handoff_lead" }))).toBe("handoff_lead")
        expect(subject.intentOfNode(TRIGGER)).toBeNull()
        expect(subject.intentOfNode(stepNode("approval"))).toBeNull()
        expect(subject.intentOfNode(END)).toBeNull()
    })
})

describe("heldIntents and reachableIntents", () => {
    it("lists every intent the graph holds, reachable or not", async () => {
        const subject = await build()

        expect(subject.heldIntents(GRAPH)).toEqual(["reply_customer", "send_quote", "give_discount", "adjust_stock"])
    })

    it("lists the intents a trigger reaches, through the branches of a decide point, with the title of the node", async () => {
        const subject = await build()

        expect(subject.reachableIntents(GRAPH, "customer_message")).toEqual([
            { intent: "reply_customer", label: "Answer" },
        ])
        expect(subject.reachableIntents(GRAPH, "tag")).toEqual([
            { intent: "send_quote", label: "Quote" },
            { intent: "give_discount", label: "Discount" },
        ])
    })

    it("lists an intent once, walks a node once and ignores a lead to a node that is gone", async () => {
        const subject = await build()
        const graph: GraphDocument = {
            nodes: [
                nodeOf({ key: "t", kind: "trigger", step: "tag", next: ["a", "b", "missing"] }),
                nodeOf({ key: "a", step: "write", action: "send_quote", title: "First", next: ["b"] }),
                nodeOf({ key: "b", step: "write", action: "send_quote", title: "Second", next: [] }),
            ],
            rights: [],
        }

        expect(subject.reachableIntents(graph, "tag")).toEqual([{ intent: "send_quote", label: "First" }])
    })

    it("reaches nothing from a trigger the graph does not hold", async () => {
        const subject = await build()

        expect(subject.reachableIntents({ nodes: [END], rights: [] }, "tag")).toEqual([])
    })
})

describe("the events a trigger matches", () => {
    const listening: GraphDocument = {
        nodes: [
            {
                ...nodeOf({ ...TRIGGER, key: "chat", step: "event", next: ["a"] }),
                trigger: { eventTypes: ["chat_message"], sources: ["web"] },
            },
            {
                ...nodeOf({ ...TRIGGER, key: "any", step: "event", next: ["b"] }),
                trigger: { eventTypes: ["chat_message"], sources: [] },
            },
            nodeOf({ ...TRIGGER, key: "clock", step: "schedule", next: ["c"] }),
            nodeOf({ key: "a", step: "write", action: "first", title: "First", next: [] }),
            nodeOf({ key: "b", step: "write", action: "second", title: "Second", next: [] }),
            nodeOf({ key: "c", step: "write", action: "third", title: "Third", next: [] }),
        ],
        rights: [],
    }

    it("reads the event types of a node from what it names, else from its step", async () => {
        const subject = await build()

        expect(subject.eventTypesOf(listening.nodes[0] ?? TRIGGER)).toEqual(["chat_message"])
        expect(subject.eventTypesOf(TRIGGER)).toEqual(["customer_message"])
        expect(subject.eventTypesOf(nodeOf({ ...TRIGGER, step: "tag" }))).toEqual(["tag"])
        expect(subject.eventTypesOf(nodeOf({ ...TRIGGER, step: "schedule" }))).toEqual([])
        expect(subject.eventTypesOf(END)).toEqual([])
    })

    it("walks from the nodes that match the type and the source, and from any source for a node that names none", async () => {
        const subject = await build()

        expect(subject.reachableIntents(listening, "chat_message", "web").map((entry) => entry.intent)).toEqual([
            "first",
            "second",
        ])
        expect(subject.reachableIntents(listening, "chat_message", "telegram").map((entry) => entry.intent)).toEqual([
            "second",
        ])
        expect(subject.reachableIntents(listening, "chat_message").map((entry) => entry.intent)).toEqual(["second"])
        expect(subject.reachableIntents(listening, "other", "web")).toEqual([])
    })
})
