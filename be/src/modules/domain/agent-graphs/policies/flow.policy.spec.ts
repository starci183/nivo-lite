import { Test } from "@nestjs/testing"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { flowChanged, isFlowOnly, requireSoundFlow, sameFlow } from "./flow.policy"

/** The members of the subject under test. */
interface Subject {
    readonly sameFlow: typeof sameFlow
    readonly isFlowOnly: typeof isFlowOnly
}

const SUBJECT = Symbol("flow.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sameFlow, isFlowOnly } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NODE_A: GraphSpecNode = {
    key: "a",
    kind: "execute",
    step: "x",
    input: { text: { $ref: "trigger.text" }, list: [1, null, "b"] },
    next: "b",
}

const NODE_B: GraphSpecNode = { key: "b", kind: "output", step: "stop" }

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [NODE_A, NODE_B],
}

describe("sameFlow", () => {
    it("is false for a graph with no flow", async () => {
        const subject = await build()

        expect(subject.sameFlow(undefined, FLOW)).toBe(false)
    })

    it("is true for the same flow, whatever the order of the keys and an unset key", async () => {
        const subject = await build()
        const reordered: GraphSpec = {
            nodes: [
                {
                    next: "b",
                    step: "x",
                    kind: "execute",
                    key: "a",
                    params: undefined,
                    input: { list: [1, null, "b"], text: { $ref: "trigger.text" } },
                },
                { step: "stop", kind: "output", key: "b" },
            ],
            grant: { effects: [], tools: [], rights: [] },
            trigger: { sources: ["channel"], kind: "tag" },
            moduleKey: "sales",
            schema: "nivo/agent-graph@1",
        }

        expect(subject.sameFlow(reordered, FLOW)).toBe(true)
    })

    it("is false when a value, a node or an element of a list differs", async () => {
        const subject = await build()
        expect(subject.sameFlow({ ...FLOW, moduleKey: "chatbot" }, FLOW)).toBe(false)
        expect(subject.sameFlow({ ...FLOW, nodes: [NODE_A] }, FLOW)).toBe(false)
        expect(
            subject.sameFlow(
                {
                    ...FLOW,
                    nodes: [{ ...NODE_A, input: { list: [1, null, "c"] } }, NODE_B],
                },
                FLOW,
            ),
        ).toBe(false)
    })
})

describe("flowChanged and requireSoundFlow", () => {
    const index = nodeIndexOf({ nodes: [], effects: [], tools: [], dataKinds: [] })

    it("tells a flow added, dropped or changed from one kept or never there", () => {
        expect(flowChanged(undefined, undefined)).toBe(false)
        expect(flowChanged(FLOW, undefined)).toBe(true)
        expect(flowChanged(undefined, FLOW)).toBe(true)
        expect(flowChanged(FLOW, { ...FLOW })).toBe(false)
    })

    it("passes a flow the installed nodes take and refuses one they do not, naming each problem", () => {
        expect(() =>
            requireSoundFlow(
                {
                    ...FLOW,
                    nodes: [{ key: "end", kind: "output", step: "stop" }],
                    grant: { rights: [], tools: [], effects: [] },
                },
                index,
            ),
        ).not.toThrow()
        const refusal = (): unknown => {
            try {
                requireSoundFlow(FLOW, index)
                return null
            } catch (cause) {
                return cause
            }
        }
        const refused = refusal()
        expect(refused instanceof AgentGraphsError ? refused.code : refused).toBe(AgentGraphsErrorCode.PublishRefused)
    })
})

describe("isFlowOnly", () => {
    it("is true for a graph with a flow and no old node, and false for one with old nodes or with no flow", async () => {
        const subject = await build()
        const old = { nodes: [nodeOf({ key: "n" })] }

        expect(subject.isFlowOnly({ nodes: [], rights: [], flow: FLOW })).toBe(true)
        expect(subject.isFlowOnly({ ...old, rights: [], flow: FLOW })).toBe(false)
        expect(subject.isFlowOnly({ nodes: [], rights: [] })).toBe(false)
    })
})
