import { Test } from "@nestjs/testing"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { defineNode, nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { coreDataKinds, coreEffects, coreNodes, coreTools, TOOL } from "@nivo-lite/blocks-core"
import { nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { flowChanged, isFlowOnly, requireSoundFlow, requireSoundRefs, sameFlow } from "./flow.policy"

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

    it("refuses a flow of a module whose step reaches a tool outside the tool set of the module's agent, naming the step and the tool", () => {
        const installed = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })
        const ledger = { key: "ledger", kind: "output" as const, step: "accounting.post-payment", next: "end" }
        const flow = {
            ...FLOW,
            moduleKey: "chatbot",
            grant: { rights: installed.nodes.get(ledger.step)?.rights ?? [], tools: [TOOL.ledgerAppend], effects: [] },
            nodes: [ledger, { key: "end", kind: "output" as const, step: "stop" }],
        }
        const refusal = (): unknown => {
            try {
                requireSoundFlow(flow, installed)
                return null
            } catch (cause) {
                return cause
            }
        }
        const refused = refusal()
        expect(refused).toBeInstanceOf(AgentGraphsError)
        expect(refused instanceof AgentGraphsError ? refused.params.problems : "").toContain(
            `GRAPH_TOOL_OUTSIDE_AGENT ledger:${TOOL.ledgerAppend}`,
        )
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

describe("requireSoundRefs", () => {
    const reply = defineNode({
        id: "core.reply",
        role: "output",
        title: { key: "t" },
        params: z.object({ text: z.string() }),
        input: z.object({}),
        output: z.object({}),
        rights: [],
        effects: [],
        run: () => Promise.resolve({}),
        examples: [{ name: "e", params: { text: "x" }, input: {}, output: {}, effects: [] }],
    })
    const index = nodeIndexOf({ nodes: [reply], effects: [], tools: [], dataKinds: [] })
    const flowWith = (text: unknown): GraphSpec => ({
        schema: "nivo/agent-graph@1",
        moduleKey: "sales",
        trigger: { kind: "tag", sources: ["channel"] },
        grant: { rights: [], tools: [], effects: [] },
        nodes: [
            { key: "a", kind: "output", step: "core.reply", params: { text: "hi" }, next: "b" },
            { key: "b", kind: "output", step: "core.reply", params: { text: text as string } },
        ],
    })

    it("passes sound refs and refuses a broken one with its words in Vietnamese and every problem for the editor", () => {
        expect(() => requireSoundRefs(flowWith({ $ref: "lead.address" }), index)).not.toThrow()
        const refusal = (): unknown => {
            try {
                requireSoundRefs(flowWith({ $ref: "steps.ghost.output.x" }), index)
                return null
            } catch (cause) {
                return cause
            }
        }
        const error = refusal()
        expect(error).toBeInstanceOf(AgentGraphsError)
        expect(error).toMatchObject({ code: AgentGraphsErrorCode.RefsRefused, params: { count: "1" } })
        const params = (error as AgentGraphsError).params
        expect(params["first"]).toContain("quy trình không có bước này")
        expect(JSON.parse(String(params["problems"]))).toEqual([
            expect.objectContaining({ code: "REF_NODE_UNKNOWN", nodeKey: "b", field: "text", messageKey: "workflowRef.refNodeUnknown" }),
        ])
    })
})

