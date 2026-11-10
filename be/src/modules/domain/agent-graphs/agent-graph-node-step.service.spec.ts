import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { NodeRunError } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { DAY_MS, FINGERPRINT, FLOW, NOW, TRIGGER, stepOf } from "@tests/fixtures/builders/agent-graph-node-step.builder"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { StepDecision, StepSpec } from "@modules/domain/agent-runs"
import { AgentTagService } from "@modules/domain/agent-work"
import {
    GraphNodeHostService,
    GraphNodeRegistryService,
    GraphNodesError,
    GraphNodesErrorCode,
} from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphNodeStepService } from "./agent-graph-node-step.service"
import { AgentGraphRunNoticesService } from "./agent-graph-run-notices.service"
import { AgentGraphTurnPolicyService } from "./agent-graph-turn-policy.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { GraphDocument } from "./agent-graphs.contracts"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"
import { EMPTY_GRANT, ownRunGrantOf } from "./policies/workflow-grant.policy"

const raise = mock<NodeEffectExecutor>({ effect: TOOL.workItemRaise })
raise.execute.mockResolvedValue({ kind: "work-item", id: "w-1" })

/** The installed node definitions as the registry answers them: one `order.keep` that says `blocking` as given. */
const installedWith = (blocking?: boolean): ReturnType<GraphNodeRegistryService["installed"]> =>
    mock<ReturnType<GraphNodeRegistryService["installed"]>>({
        nodes: new Map(
            blocking === undefined ? [] : [["order.keep", mock<NodeDefinition>({ id: "order.keep", blocking })]],
        ),
    })

const build = async (
    document: GraphDocument = { nodes: [], rights: [], flow: FLOW },
    policy?: AgentGraphTurnPolicyService,
) => {
    const handlers = mock<AgentRunHandlersService>()
    const tags = mock<AgentTagService>()
    tags.release.mockResolvedValue(undefined)
    const graphs = mock<AgentGraphsService>({
        documentOf: jest.fn().mockResolvedValue(document),
        runGrantOf: jest.fn().mockResolvedValue(ownRunGrantOf(document.flow?.grant ?? EMPTY_GRANT)),
    })
    const host = mock<GraphNodeHostService>()
    const nodes = mock<GraphNodeRegistryService>({
        optionalExecutorOf: jest.fn().mockReturnValue(raise),
        installed: jest.fn().mockReturnValue(installedWith()),
    })
    const notices = mock<AgentGraphRunNoticesService>({
        runStopped: jest.fn().mockResolvedValue(undefined),
        sidePassedOver: jest.fn().mockResolvedValue(undefined),
        stuck: jest.fn().mockResolvedValue(undefined),
    })
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
            { provide: AgentGraphRunNoticesService, useValue: notices },
            ...(policy === undefined ? [] : [{ provide: AgentGraphTurnPolicyService, useValue: policy }]),
        ],
    }).compile()
    return { steps: moduleRef.get(AgentGraphNodeStepService), handlers, host, nodes, tags, notices }
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
                handedOffBy: null,
            },
            grant: { rights: [], tools: ["order.look"] },
            key: "run-1:keep",
        })
    })

    it("runs the node in a turn that carries the policy of the workflow's module, read for the step's own key", async () => {
        const policy = mock<AgentGraphTurnPolicyService>()
        policy.toldOf.mockImplementation((turn) =>
            Promise.resolve({ ...turn, guidance: "CHÍNH SÁCH", policy: { approvalThresholdVnd: 3_000_000 } }),
        )
        const { steps, host } = await build(undefined, policy)
        host.run.mockResolvedValue({ output: { done: true }, effects: [] })

        await steps.run(stepOf("keep"))

        expect(policy.toldOf).toHaveBeenCalledWith(expect.objectContaining({ turnId: "run-1" }), "sales", "run-1:keep")
        expect(host.run).toHaveBeenCalledWith(
            expect.objectContaining({
                turn: expect.objectContaining({ guidance: "CHÍNH SÁCH", policy: { approvalThresholdVnd: 3_000_000 } }),
            }),
        )
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

describe("AgentGraphNodeStepService failures and undo", () => {
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

    it("fails a step whose effect a capability refused with the node refusal its domain error reports", async () => {
        const { steps, host } = await build()
        host.run.mockRejectedValueOnce(
            new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid, params: { refusal: "RIGHTS_DENIED" } }),
        )

        await expect(steps.run(stepOf("keep"))).resolves.toEqual({ kind: "failed", code: "RIGHTS_DENIED" })
    })

    it("stops the step on a domain error that names no refusal under the error's own code, and tells the team", async () => {
        const { steps, host, notices } = await build()
        const unnamed = new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid, params: { refusal: 7 } })
        host.run.mockRejectedValueOnce(unnamed)

        await expect(steps.run(stepOf("keep"))).resolves.toEqual({
            kind: "failed",
            code: AgentGraphsErrorCode.DocumentInvalid,
        })
        expect(notices.stuck).toHaveBeenCalledWith(
            expect.objectContaining({ code: AgentGraphsErrorCode.DocumentInvalid }),
            expect.objectContaining({ report: null, customerLine: null }),
        )
    })

    it("never rejects when the node throws: with no AI core to decide, the step stops as handler_threw and the team reads the raw words as a fact", async () => {
        const { steps, host, notices } = await build()
        host.run.mockRejectedValue(new Error("port down"))

        await expect(steps.run(stepOf("keep"))).resolves.toEqual({ kind: "failed", code: "handler_threw" })

        expect(notices.troubled).toHaveBeenCalledWith(
            expect.objectContaining({ stepKey: "keep" }),
            expect.objectContaining({ kind: "threw", code: "handler_threw", text: "Error: port down" }),
        )
        expect(notices.stuck).toHaveBeenCalledTimes(1)
        expect(notices.stuck).toHaveBeenCalledWith(
            expect.objectContaining({ code: "handler_threw", trigger: TRIGGER }),
            {
                report: null,
                customerLine: null,
                leadId: null,
                facts: expect.arrayContaining([
                    ["step", "keep (order.keep)"],
                    ["code", "handler_threw"],
                    ["error", "Error: port down"],
                    ["run", "run-1"],
                ]),
            },
        )
    })

    it("undoes a done step's effects through the host on the subjects its result kept", async () => {
        const { steps, host } = await build()
        const done = [{ id: "order.record", subject: { kind: "order", id: "o-2" } }]

        await steps.compensate(stepOf("keep", { result: { output: {}, effects: done } }))

        expect(host.undo.mock.calls[0]?.[0]).toMatchObject({
            turn: { turnId: "run-1", workspaceId: "ws-1" },
            done,
            key: "run-1:keep",
        })
    })
})

describe("AgentGraphNodeStepService dead letters", () => {
    it("hands a dead run to its notices with the turn and the trigger the row holds", async () => {
        const { steps, notices } = await build()

        await steps.deadLetter(stepOf("keep"), "INPUT_INVALID")

        const [notice] = notices.runStopped.mock.calls[0] ?? []
        expect(notice).toMatchObject({ step: { stepKey: "keep" }, trigger: TRIGGER, code: "INPUT_INVALID" })
        expect(notice?.turn).toMatchObject({ conversationId: "c-1", locale: "en" })
    })

    it("hands a row it cannot read over with an empty trigger, in the default language", async () => {
        const { steps, notices } = await build()

        await steps.sideFailed(stepOf("keep", { input: {} }), "handler_threw")

        const [notice] = notices.sidePassedOver.mock.calls[0] ?? []
        expect(notice).toMatchObject({ trigger: {}, turn: { conversationId: null, locale: "vi" } })
    })
})

describe("AgentGraphNodeStepService side nodes", () => {
    it("passes over a side node that failed: the step keeps its failure and the run goes on to the node that follows", async () => {
        const { steps, nodes } = await build()
        nodes.installed.mockReturnValue(installedWith(false))

        await expect(steps.passOver(stepOf("keep"), "handler_threw")).resolves.toEqual({
            result: { output: null, effects: [], failed: "handler_threw", passedOver: true },
            next: [expect.objectContaining({ stepKey: "end", nodeKey: "end" })],
        })
    })

    it("leaves a node that blocks its run, and a row it cannot read, to the failure policy", async () => {
        const { steps, nodes } = await build()
        await expect(steps.passOver(stepOf("keep"), "handler_threw")).resolves.toBeNull()

        nodes.installed.mockReturnValue(installedWith(true))
        await expect(steps.passOver(stepOf("keep"), "handler_threw")).resolves.toBeNull()
        await expect(steps.passOver(stepOf("keep", { input: {} }), "handler_threw")).resolves.toBeNull()
    })

    it("takes the graph node's own `blocking: false` over a node that says nothing", async () => {
        const nodes = FLOW.nodes.map((node) => (node.key === "keep" ? { ...node, blocking: false } : node))
        const { steps } = await build({ nodes: [], rights: [], flow: { ...FLOW, nodes } })

        await expect(steps.passOver(stepOf("keep"), "handler_threw")).resolves.toMatchObject({
            result: { failed: "handler_threw", passedOver: true },
        })
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

    it("ends a step it cannot read, and fails the step where no module raises work", async () => {
        const { steps, host, nodes } = await build()

        expect(steps.onDecided(stepOf("keep", { input: {} }), { approved: true, by: "member-1" })).toMatchObject({
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

describe("AgentGraphNodeStepService approval edge cases", () => {
    beforeEach(() => raise.execute.mockClear())

    it("stops the step on an approval refusal that names no call: nobody can be asked about it, so no item is raised", async () => {
        const { steps, host } = await build()
        const unreadable = new GraphNodesError({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: { tool: "ledger.append", fingerprint: "" },
        })
        host.run.mockRejectedValue(unreadable)

        await expect(steps.run(stepOf("keep"))).resolves.toEqual({
            kind: "failed",
            code: GraphNodesErrorCode.ToolApprovalRequired,
        })
        expect(raise.execute).not.toHaveBeenCalled()
    })

    it("asks with an empty tool and reason when the refusal carries them as something other than text", async () => {
        const { steps, host } = await build()
        host.run.mockRejectedValue(
            new GraphNodesError({
                code: GraphNodesErrorCode.ToolApprovalRequired,
                params: { tool: 5, fingerprint: FINGERPRINT, reason: 7 },
            }),
        )

        await expect(steps.run(stepOf("keep"))).resolves.toMatchObject({ kind: "wait", workItemId: "w-1" })
        const key = `tool-approval:run-1:keep:${FINGERPRINT}`
        expect(raise.execute).toHaveBeenCalledWith(
            expect.objectContaining({ turnId: "run-1" }),
            {
                action: "approve_tool_call",
                title: "[agentGraphs.toolApproval.title]",
                payload: {
                    runId: "run-1",
                    nodeKey: "keep",
                    tool: "",
                    fingerprint: FINGERPRINT,
                    reason: "",
                    conversationId: "c-1",
                },
            },
            { key, dedupeKey: key },
        )
    })

    it("runs a node for a customer when the trigger came from a channel", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: { done: true }, effects: [] })
        const channel = { ...TRIGGER, origin: "channel", actorMemberId: "member-7", authorAgentId: "agent-chatbot" }

        await steps.run(stepOf("keep", { input: { versionId: "version-1", nodeKey: "keep", trigger: channel } }))

        expect(host.run.mock.calls[0]?.[0]).toMatchObject({
            turn: { origin: "customer", memberId: "member-7", conversationId: "c-1", handedOffBy: "agent-chatbot" },
        })
    })

    it("approves again under the step that first asked when the step it decides already carries an approval", async () => {
        const { steps } = await build()
        const earlier = { stepKey: "keep", by: "member-1", fingerprint: "e".repeat(64) }
        const step = stepOf("keep", {
            stepKey: "keep~approved-eeeeeeeeeeeeeeee",
            input: { versionId: "version-1", nodeKey: "keep", trigger: TRIGGER, approval: earlier },
        })

        const approval = { stepKey: "keep", by: "member-2", fingerprint: FINGERPRINT }
        expect(steps.onDecided(step, decided(true, "member-2"))).toMatchObject({
            kind: "done",
            result: { output: null, effects: [], approval },
            next: [{ stepKey: `keep~approved-${FINGERPRINT.slice(0, 16)}`, input: { approval } }],
        })
    })
})
