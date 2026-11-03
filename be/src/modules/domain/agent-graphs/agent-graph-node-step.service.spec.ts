import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { NodeRunError } from "@nivo-lite/agent-sdk/node"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { StepSpec, StepView } from "@modules/domain/agent-runs"
import { GraphNodeHostService } from "@modules/domain/graph-nodes"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphNodeStepService } from "./agent-graph-node-step.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: ["order.look"], effects: [] },
    nodes: [
        { key: "check", kind: "condition", step: "order.check", routes: { yes: "keep" } },
        { key: "keep", kind: "output", step: "order.keep", params: { n: 1 }, input: { id: { $ref: "check.id" }, t: { $ref: "trigger.text" } }, next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

const TRIGGER = { text: "hi", conversationId: "c-1", subject: { kind: "order", id: "o-1" }, locale: "en" }

const stepOf = (nodeKey: string, overrides: Partial<StepView> = {}): StepView =>
    ({
        runId: "run-1",
        workspaceId: "ws-1",
        agentId: "agent-1",
        stepKey: nodeKey,
        nodeKey,
        kind: "graph_node",
        input: { versionId: "version-1", nodeKey, trigger: TRIGGER },
        earlier: { check: { output: { branch: "yes", id: "o-9" } } },
        result: null,
        ...overrides,
    }) as unknown as StepView

const build = async (document: GraphDocument = { nodes: [], rights: [], flow: FLOW }) => {
    const handlers = mock<AgentRunHandlersService>()
    const graphs = mock<AgentGraphsService>({ documentOf: jest.fn().mockResolvedValue(document) })
    const host = mock<GraphNodeHostService>()
    const flows = mock<AgentGraphFlowRunsService>({
        stepOf: jest.fn(
            (node: GraphSpecNode, input: GraphNodeStepInput): StepSpec => ({
                stepKey: node.key,
                nodeKey: node.key,
                kind: "graph_node",
                effect: { kind: "read" },
                input: { ...input },
            }),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphNodeStepService,
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeHostService, useValue: host },
            { provide: AgentGraphFlowRunsService, useValue: flows },
        ],
    }).compile()
    return { steps: moduleRef.get(AgentGraphNodeStepService), handlers, host }
}

describe("AgentGraphNodeStepService", () => {
    it("registers its kind with the run engine once the app has started", async () => {
        const { steps, handlers } = await build()
        steps.onModuleInit()
        expect(handlers.add).toHaveBeenCalledWith(steps)
        expect(steps.kind).toBe("graph_node")
    })

    it("runs the node under the graph's grant with its input resolved, keeps its output and writes the route's next step", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: { done: true }, effects: [{ id: "order.record", subject: { kind: "order", id: "o-2" } }] })

        await expect(steps.run(stepOf("keep"))).resolves.toEqual({
            kind: "done",
            result: { output: { done: true }, effects: [{ id: "order.record", subject: { kind: "order", id: "o-2" } }] },
            next: [expect.objectContaining({ stepKey: "end", input: { versionId: "version-1", nodeKey: "end", trigger: TRIGGER } })],
        })
        expect(host.run).toHaveBeenCalledWith({
            nodeId: "order.keep",
            params: { n: 1 },
            input: { id: "o-9", t: "hi" },
            turn: {
                turnId: "run-1",
                workspaceId: "ws-1",
                agentId: "agent-1",
                subject: { kind: "order", id: "o-1" },
                conversationId: "c-1",
                locale: "en",
            },
            grant: { rights: [], tools: ["order.look"] },
            key: "run-1:keep",
        })
    })

    it("routes a condition on its branch and ends the run on a branch without a route or at stop", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValueOnce({ output: { branch: "yes" }, effects: [] }).mockResolvedValueOnce({ output: { branch: "no" }, effects: [] })

        await expect(steps.run(stepOf("check", { earlier: {} }))).resolves.toMatchObject({ next: [{ stepKey: "keep" }] })
        const bare = { ...TRIGGER, subject: "a label", conversationId: undefined }
        await expect(
            steps.run(stepOf("check", { input: { versionId: "version-1", nodeKey: "check", trigger: bare } })),
        ).resolves.toMatchObject({ next: [] })
        expect(host.run.mock.calls[1]?.[0]).toMatchObject({ params: {}, input: {}, turn: { subject: null, conversationId: null } })
        await expect(steps.run(stepOf("end"))).resolves.toEqual({ kind: "done", result: { output: null, effects: [] }, next: [] })
    })

    it("fails a row that is not a node step, a node the version does not hold, and a node that refused", async () => {
        const { steps, host } = await build()
        await expect(steps.run(stepOf("keep", { input: {} }))).resolves.toEqual({ kind: "failed", code: "invalid_step_input" })
        await expect(steps.run(stepOf("ghost"))).resolves.toEqual({ kind: "failed", code: "graph_node_missing" })
        host.run.mockRejectedValueOnce(new NodeRunError("PARAMS_INVALID", "order.keep"))
        await expect(steps.run(stepOf("keep"))).resolves.toEqual({ kind: "failed", code: "PARAMS_INVALID" })
        const bare = await build({ nodes: [], rights: [] })
        await expect(bare.steps.run(stepOf("keep"))).resolves.toEqual({ kind: "failed", code: "graph_node_missing" })
    })

    it("lets any other failure reach the engine, which tries the step again", async () => {
        const { steps, host } = await build()
        host.run.mockRejectedValue(new Error("port down"))
        await expect(steps.run(stepOf("keep"))).rejects.toThrow("port down")
    })

    it("undoes a done step's effects through the host on the subjects its result kept", async () => {
        const { steps, host } = await build()
        const done = [{ id: "order.record", subject: { kind: "order", id: "o-2" } }]

        await steps.compensate(stepOf("keep", { result: { output: {}, effects: done } }))

        expect(host.undo).toHaveBeenCalledWith({
            turn: expect.objectContaining({ turnId: "run-1", workspaceId: "ws-1" }),
            done,
            key: "run-1:keep",
        })
    })
})
