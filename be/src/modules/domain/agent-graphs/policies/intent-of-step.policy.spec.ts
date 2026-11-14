import { Test } from "@nestjs/testing"
import { END, TRIGGER, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { STEPS_OF_KIND, kindOfStep } from "../agent-graphs.contracts"
import type { GraphDocument, GraphNode, GraphNodeStep } from "../agent-graphs.contracts"
import { INTENT_OF_STEP, heldIntents, intentOfNode } from "./intent-of-step.policy"

const SUBJECT = Symbol("intent-of-step.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { intentOfNode, heldIntents } }],
    }).compile()
    return moduleRef.get<{
        intentOfNode: typeof intentOfNode
        heldIntents: typeof heldIntents
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
                branches: [{ key: "a", when: "else", mode: "ask", next: "discount", approver: null, sources: [] }],
            },
        }),
        nodeOf({ key: "discount", step: "write", action: "give_discount", title: "Discount", next: ["end"] }),
        nodeOf({ key: "lost", step: "write", action: "adjust_stock", title: "Lost", next: ["end"] }),
        END,
    ],
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

describe("heldIntents", () => {
    it("lists every intent the graph holds, reachable or not", async () => {
        const subject = await build()

        expect(subject.heldIntents(GRAPH)).toEqual(["reply_customer", "send_quote", "give_discount", "adjust_stock"])
    })
})
