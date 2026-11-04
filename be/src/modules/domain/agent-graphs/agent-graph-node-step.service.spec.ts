import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { NodeRunError } from "@nivo-lite/agent-sdk/node"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import { AgentTagService } from "@modules/domain/agent-work"
import type { StepDecision, StepSpec, StepView } from "@modules/domain/agent-runs"
import type { NodeEffectExecutor } from "@modules/domain/graph-nodes"
import {
    GraphNodeHostService,
    GraphNodeRegistryService,
    GraphNodesError,
    GraphNodesErrorCode,
} from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
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
        {
            key: "keep",
            kind: "output",
            step: "order.keep",
            params: { n: 1 },
            input: { id: { $ref: "check.id" }, t: { $ref: "trigger.text" } },
            next: "end",
        },
        { key: "end", kind: "output", step: "stop" },
    ],
}

const TRIGGER = { text: "hi", conversationId: "c-1", subject: { kind: "order", id: "o-1" }, locale: "en" }

const stepOf = (nodeKey: string, overrides: Partial<StepView> = {}): StepView =>
    stepViewOf({
        stepKey: nodeKey,
        nodeKey,
        kind: "graph_node",
        input: { versionId: "version-1", nodeKey, trigger: TRIGGER },
        earlier: { check: { output: { branch: "yes", id: "o-9" } } },
        ...overrides,
    })

const NOW = Date.parse("2026-11-04T10:00:00.000Z")
const DAY_MS = 86_400_000
const FINGERPRINT = "f".repeat(64)

const raise = mock<NodeEffectExecutor>({
    effect: "work-item.raise",
    execute: jest.fn().mockResolvedValue({ kind: "work-item", id: "w-1" }),
})

const build = async (document: GraphDocument = { nodes: [], rights: [], flow: FLOW }) => {
    const handlers = mock<AgentRunHandlersService>()
    const tags = mock<AgentTagService>()
    tags.release.mockResolvedValue(undefined)
    const graphs = mock<AgentGraphsService>({ documentOf: jest.fn().mockResolvedValue(document) })
    const host = mock<GraphNodeHostService>()
    const nodes = mock<GraphNodeRegistryService>({ optionalExecutorOf: jest.fn().mockReturnValue(raise) })
    const flows = mock<AgentGraphFlowRunsService>({
        stepOf: jest.fn((node: GraphSpecNode, input: GraphNodeStepInput): StepSpec => ({
            stepKey: node.key,
            nodeKey: node.key,
            kind: "graph_node",
            effect: { kind: "read" },
            input: { ...input },
        })),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphNodeStepService,
            { provide: AgentRunHandlersService, useValue: handlers },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeHostService, useValue: host },
            { provide: AgentGraphFlowRunsService, useValue: flows },
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentTagService, useValue: tags },
        ],
    }).compile()
    return { steps: moduleRef.get(AgentGraphNodeStepService), handlers, host, nodes, tags }
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
        host.run.mockResolvedValue({
            output: { done: true },
            effects: [{ id: "order.record", subject: { kind: "order", id: "o-2" } }],
        })

        await expect(steps.run(stepOf("keep"))).resolves.toEqual({
            kind: "done",
            result: {
                output: { done: true },
                effects: [{ id: "order.record", subject: { kind: "order", id: "o-2" } }],
            },
            next: [
                expect.objectContaining({
                    stepKey: "end",
                    input: { versionId: "version-1", nodeKey: "end", trigger: TRIGGER },
                }),
            ],
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
                origin: "system",
                memberId: null,
            },
            grant: { rights: [], tools: ["order.look"] },
            key: "run-1:keep",
        })
    })

    it("routes a condition on its branch and ends the run on a branch without a route or at stop", async () => {
        const { steps, host } = await build()
        host.run
            .mockResolvedValueOnce({ output: { branch: "yes" }, effects: [] })
            .mockResolvedValueOnce({ output: { branch: "no" }, effects: [] })

        await expect(steps.run(stepOf("check", { earlier: {} }))).resolves.toMatchObject({
            next: [{ stepKey: "keep" }],
        })
        const bare = { ...TRIGGER, subject: "a label", conversationId: undefined }
        await expect(
            steps.run(stepOf("check", { input: { versionId: "version-1", nodeKey: "check", trigger: bare } })),
        ).resolves.toMatchObject({ next: [] })
        expect(host.run.mock.calls[1]?.[0]).toMatchObject({
            params: {},
            input: {},
            turn: { subject: null, conversationId: null },
        })
        await expect(steps.run(stepOf("end"))).resolves.toEqual({
            kind: "done",
            result: { output: null, effects: [] },
            next: [],
        })
    })
})

describe("AgentGraphNodeStepService refusals", () => {
    it("fails a row that is not a node step, a node the version does not hold, and a node that refused", async () => {
        const { steps, host } = await build()
        await expect(steps.run(stepOf("keep", { input: {} }))).resolves.toEqual({
            kind: "failed",
            code: "invalid_step_input",
        })
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
            turn: {
                turnId: "run-1",
                workspaceId: "ws-1",
                agentId: "agent-1",
                subject: { kind: "order", id: "o-1" },
                conversationId: "c-1",
                locale: "en",
                origin: "system",
                memberId: null,
            },
            done,
            key: "run-1:keep",
        })
    })
})

describe("AgentGraphNodeStepService dead letters", () => {
    beforeEach(() => raise.execute.mockClear())

    it("raises one owner review per dead run, naming the run, the node and why, in the trigger's language", async () => {
        const { steps } = await build()

        await steps.deadLetter(stepOf("keep"), "INPUT_INVALID")
        await steps.deadLetter(stepOf("keep"), "INPUT_INVALID")

        const [turn, payload, call] = raise.execute.mock.calls[0] ?? []
        expect(turn).toMatchObject({ workspaceId: "ws-1", agentId: "agent-1", conversationId: "c-1", locale: "en" })
        expect(payload).toEqual({
            action: "review_agent_run",
            title: "[agentGraphs.runDead.title]",
            payload: { runId: "run-1", nodeKey: "keep", code: "INPUT_INVALID", conversationId: "c-1" },
        })
        expect(call).toEqual({ key: "graph-run-dead:run-1", dedupeKey: "graph-run-dead:run-1" })
        expect(new Set(raise.execute.mock.calls.map((each) => each[2].dedupeKey)).size).toBe(1)
    })

    it("raises for a row it cannot read, and stays quiet where no module raises work", async () => {
        const { steps, nodes } = await build()
        await steps.deadLetter(stepOf("keep", { input: {} }), "invalid_step_input")
        expect(raise.execute.mock.calls[0]?.[0]).toMatchObject({ conversationId: null, locale: "vi" })

        nodes.optionalExecutorOf.mockReturnValue(undefined)
        await steps.deadLetter(stepOf("keep"), "x")
        expect(raise.execute).toHaveBeenCalledTimes(1)
    })
})

/** The refusal a door answers for a tool call that waits for a person. */
const approvalRequired = (): GraphNodesError =>
    new GraphNodesError({
        code: GraphNodesErrorCode.ToolApprovalRequired,
        params: { tool: "ledger.append", fingerprint: FINGERPRINT, reason: "ask_mode" },
    })

/** The verdict of the owner on the approval item, as the run engine hands it over. */
const decided = (approved: boolean, by: string | null): StepDecision => ({
    approved,
    by,
    data: { fields: { tool: "ledger.append", fingerprint: FINGERPRINT }, draft: null },
})

describe("AgentGraphNodeStepService approvals", () => {
    beforeEach(() => raise.execute.mockClear())

    it("asks the owner once for a tool call the grant asks about and waits for the answer until the deadline", async () => {
        const { steps, host } = await build()
        host.run.mockRejectedValue(approvalRequired())
        const key = `tool-approval:run-1:keep:${FINGERPRINT}`

        await expect(steps.run(stepOf("keep"))).resolves.toEqual({
            kind: "wait",
            workItemId: "w-1",
            deadlineAt: new Date(NOW + DAY_MS),
        })
        await steps.run(stepOf("keep"))

        const payload = {
            action: "approve_tool_call",
            title: "[agentGraphs.toolApproval.title]",
            payload: {
                runId: "run-1",
                nodeKey: "keep",
                tool: "ledger.append",
                fingerprint: FINGERPRINT,
                reason: "ask_mode",
                conversationId: "c-1",
            },
        }
        expect(raise.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({ turnId: "run-1" }), payload, {
            key,
            dedupeKey: key,
        })
        expect(raise.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({ turnId: "run-1" }), payload, {
            key,
            dedupeKey: key,
        })
    })

    it("approve: runs the node again in a step of its own under the asking step's key, with the approval of that exact call", async () => {
        const { steps } = await build()

        const answer = steps.onDecided(stepOf("keep", { effect: { kind: "pivot" } }), decided(true, "member-1"))

        const approval = { stepKey: "keep", by: "member-1", fingerprint: FINGERPRINT }
        expect(answer).toEqual({
            kind: "done",
            result: { output: null, effects: [], approval },
            next: [
                {
                    stepKey: `keep~approved-${FINGERPRINT.slice(0, 16)}`,
                    nodeKey: "keep",
                    kind: "graph_node",
                    effect: { kind: "pivot" },
                    input: { versionId: "version-1", nodeKey: "keep", trigger: TRIGGER, approval },
                },
            ],
        })
    })
})

describe("AgentGraphNodeStepService runs after an approval", () => {
    it("the run after an approval hands the host the approval under the asking step's key, so no effect runs twice", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: { done: true }, effects: [] })
        const approval = { stepKey: "keep", by: "member-1", fingerprint: FINGERPRINT }
        const step = stepOf("keep", {
            stepKey: `keep~approved-${FINGERPRINT.slice(0, 16)}`,
            input: { versionId: "version-1", nodeKey: "keep", trigger: TRIGGER, approval },
        })

        await expect(steps.run(step)).resolves.toMatchObject({ kind: "done", next: [{ stepKey: "end" }] })
        expect(host.run).toHaveBeenCalledWith(
            expect.objectContaining({ key: "run-1:keep", approval: { by: "member-1", fingerprint: FINGERPRINT } }),
        )
    })

    it("args changed: a run after an approval whose call changed asks again, once more under the asking step", async () => {
        const { steps, host } = await build()
        host.run.mockRejectedValue(approvalRequired())
        const approval = { stepKey: "keep", by: "member-1", fingerprint: "e".repeat(64) }
        const step = stepOf("keep", {
            stepKey: "keep~approved-eeeeeeeeeeeeeeee",
            input: { versionId: "version-1", nodeKey: "keep", trigger: TRIGGER, approval },
        })

        const key = `tool-approval:run-1:keep:${FINGERPRINT}`
        await expect(steps.run(step)).resolves.toMatchObject({ kind: "wait", workItemId: "w-1" })
        expect(raise.execute).toHaveBeenCalledWith(expect.anything(), expect.anything(), { key, dedupeKey: key })
    })
})

describe("AgentGraphNodeStepService approval verdicts", () => {
    it("refuse and expire: the step ends with why, and the node does not run again", async () => {
        const { steps } = await build()

        expect(steps.onDecided(stepOf("keep"), decided(false, "member-1"))).toEqual({
            kind: "done",
            result: { output: null, effects: [], failed: "owner_refused" },
            next: [],
        })
        expect(steps.onDecided(stepOf("keep"), decided(false, "timeout"))).toEqual({
            kind: "done",
            result: { output: null, effects: [], failed: "approval_expired" },
            next: [],
        })
        expect(steps.onDecided(stepOf("keep"), decided(true, null))).toMatchObject({
            result: { failed: "owner_refused" },
        })
    })

    it("double approve: the same verdict gives the same single next step, so the engine's one wait admits one run", async () => {
        const { steps } = await build()

        const first = steps.onDecided(stepOf("keep"), decided(true, "member-1"))
        const second = steps.onDecided(stepOf("keep"), decided(true, "member-1"))

        expect(second).toEqual(first)
        expect(first.kind === "done" ? first.next : []).toHaveLength(1)
    })

    it("ends a verdict it cannot read, and fails the step where no module raises work", async () => {
        const { steps, host, nodes } = await build()

        expect(steps.onDecided(stepOf("keep"), { approved: true, by: "member-1" })).toMatchObject({
            result: { failed: "approval_unreadable" },
        })
        host.run.mockRejectedValue(approvalRequired())
        nodes.optionalExecutorOf.mockReturnValue(undefined)
        await expect(steps.run(stepOf("keep"))).resolves.toEqual({ kind: "failed", code: "approval_unavailable" })
    })
})

describe("AgentGraphNodeStepService the end of an agent's work", () => {
    it("hands the conversation on when the run's path ends at stop or at a node with no next, for the run's agent", async () => {
        const { steps, host, tags } = await build()
        host.run.mockResolvedValue({ output: { branch: "no" }, effects: [] })

        await steps.run(stepOf("end"))
        await steps.run(stepOf("check"))

        expect(tags.release).toHaveBeenCalledTimes(2)
        expect(tags.release).toHaveBeenCalledWith("ws-1", "c-1", "agent-1")
    })

    it("keeps the conversation while the path goes on, and has none to hand on without a conversation", async () => {
        const { steps, host, tags } = await build()
        host.run.mockResolvedValue({ output: { done: true }, effects: [] })
        const bare = { ...TRIGGER, conversationId: undefined }

        await steps.run(stepOf("keep"))
        await steps.run(stepOf("end", { input: { versionId: "version-1", nodeKey: "end", trigger: bare } }))

        expect(tags.release).not.toHaveBeenCalled()
    })
})
