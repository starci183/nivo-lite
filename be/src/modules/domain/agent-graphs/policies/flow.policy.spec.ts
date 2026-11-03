import { Test } from "@nestjs/testing"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { sameFlow } from "./flow.policy"

/** The members of the subject under test. */
interface Subject {
    readonly sameFlow: typeof sameFlow
}

const SUBJECT = Symbol("flow.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sameFlow } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [
        { key: "a", kind: "execute", step: "x", input: { text: { $ref: "trigger.text" }, list: [1, null, "b"] }, next: "b" },
        { key: "b", kind: "output", step: "stop" },
    ],
}

describe("sameFlow", () => {
    it("is false for a graph with no flow", async () => {
        const subject = await build()

        expect(subject.sameFlow(undefined, FLOW)).toBe(false)
    })

    it("is true for the same flow, whatever the order of the keys and an unset key", async () => {
        const subject = await build()
        const reordered = {
            nodes: [
                { next: "b", step: "x", kind: "execute", key: "a", params: undefined, input: { list: [1, null, "b"], text: { $ref: "trigger.text" } } },
                { step: "stop", kind: "output", key: "b" },
            ],
            grant: { effects: [], tools: [], rights: [] },
            trigger: { sources: ["channel"], kind: "tag" },
            moduleKey: "sales",
            schema: "nivo/agent-graph@1",
        } as GraphSpec

        expect(subject.sameFlow(reordered, FLOW)).toBe(true)
    })

    it("is false when a value, a node or an element of a list differs", async () => {
        const subject = await build()
        const [first, second] = FLOW.nodes

        expect(subject.sameFlow({ ...FLOW, moduleKey: "chatbot" }, FLOW)).toBe(false)
        expect(subject.sameFlow({ ...FLOW, nodes: [first as GraphSpec["nodes"][number]] }, FLOW)).toBe(false)
        expect(
            subject.sameFlow(
                { ...FLOW, nodes: [{ ...(first as GraphSpec["nodes"][number]), input: { list: [1, null, "c"] } }, second as GraphSpec["nodes"][number]] },
                FLOW,
            ),
        ).toBe(false)
    })
})
