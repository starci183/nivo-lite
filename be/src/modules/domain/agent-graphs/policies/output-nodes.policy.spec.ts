import { Test } from "@nestjs/testing"
import { nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { outputNodesOf } from "./output-nodes.policy"

interface Subject {
    readonly outputNodesOf: typeof outputNodesOf
}

const SUBJECT = Symbol("output-nodes.policy")

const build = async (): Promise<Subject> => {
    const container = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { outputNodesOf } }],
    }).compile()
    return container.get<Subject>(SUBJECT)
}

describe("output-nodes.policy outputNodesOf", () => {
    it("answers empty keys when the graph contains no output or approval or reply", async () => {
        const subject = await build()

        expect(subject.outputNodesOf({ nodes: [], rights: [] })).toEqual({ output: "", approval: "", reply: "" })
    })

    it("selects the approval leading to the gateway output and the reply by its declared step", async () => {
        const subject = await build()
        const document = {
            nodes: [
                nodeOf({ key: "other", step: "write", action: "pay_supplier" }),
                nodeOf({ key: "output", step: "write", action: "gateway_call" }),
                nodeOf({ key: "unrelated", step: "approval", next: ["other"] }),
                nodeOf({ key: "approval", step: "approval", next: ["output"] }),
                nodeOf({ key: "reply", step: "reply", action: undefined }),
            ],
            rights: [],
        }

        expect(subject.outputNodesOf(document)).toEqual({ output: "output", approval: "approval", reply: "reply" })
    })

    it("recognizes the reply action even when its step has a different name", async () => {
        const subject = await build()
        const nodes = [nodeOf({ key: "reply-action", step: "write", action: "reply_customer" })]

        expect(subject.outputNodesOf({ nodes, rights: [] })).toEqual({
            output: "",
            approval: "",
            reply: "reply-action",
        })
    })
})
