import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { ToolReceiptsService } from "@modules/domain/tool-receipts"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    GRAPH_NODE_MODEL,
    GRAPH_NODE_TOOL_DOOR,
    GraphNodeEffectsService,
    GraphNodeHostService,
    GraphNodeRegistryService,
    GraphNodeRunTokensService,
    GraphNodesErrorCode,
    type NodeEffectExecutor,
    type NodeModelDoor,
    type NodeRunClaims,
    type NodeRunInput,
} from "@modules/domain/graph-nodes"
import {
    NodeToolDoorService,
    AgentAccountsService,
    ToolRegistryService,
    NODE_REQUESTS_GATE,
} from "@modules/domain/tools"
import type { NativeToolFamily, NodeRequestsGate, OptionalNodeRequest, ToolManifest } from "@modules/domain/tools"
import { NativeRunnerService } from "@modules/domain/tools/native-runner.service"
import { NATIVE_TOOL_FAMILIES, TOOLS_OPTIONS } from "@modules/domain/tools/tools.decorators"
import { AccountAttachmentsService, ToolGrantsService } from "@modules/domain/tool-grants"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { PROBE_RUN } from "@tests/fixtures/builders/graph-nodes.builder"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

// The road from a SHIPPED template node to the refusal of its setup, through the real host, the real tool door, the real gateway and
// its one runner (only the stores and the runner are doubles): the care nodes arm their timer through `nivo.tool.timer.arm` (a default
// node tool). On the template road a workflow step whose node states no readable mode (`node_mode_unknown`: the engine has no default)
// freezes the step with `GRAPH_NODES_TOOL_NOT_GRANTED`; the node never reads `{ ok: false, refusal: "node_mode_unknown" }` and the
// runner never runs. A node that states `ask` stops for a person (the typed approval error, reason `ask_mode`).

const NOW = "2026-11-12T08:00:00.000Z"

/** The run's claims: a step of a workflow, so its effects follow the step's node mode. */
const CLAIMS: NodeRunClaims = {
    workspaceId: "ws-1",
    agentId: "a-1",
    runId: "run-1",
    conversationId: null,
    origin: "system",
    memberId: null,
    scope: "workspace",
    expiresAt: 9_999_999_999_999,
    step: { nodeKey: "n1", versionId: "v-1", workflowId: "wf-1" },
}

/** The native connector serving the timer tool as a write (what its manifest says), as the care nodes reach it. */
const NATIVE: ToolManifest = {
    key: "timers",
    namespace: "nivo",
    name: "Timers",
    contractVersion: "1",
    tools: [
        {
            name: TOOL.timerArm.slice("nivo.".length),
            description: TOOL.timerArm,
            scope: "write" as const,
            inputSchema: { type: "object" },
            argumentSchema: z.record(z.string(), z.unknown()),
            defaultMode: "auto" as const,
            stepGranted: true,
        },
    ],
}

/** The real host over the real door, the step's node declaring `request` (null: no readable mode). */
const build = async (request: OptionalNodeRequest) => {
    const registry = mock<GraphNodeRegistryService>()
    const effects = mock<GraphNodeEffectsService>()
    const tokens = mock<GraphNodeRunTokensService>()
    const grants = mock<ToolGrantsService>()
    const executor = mock<NodeEffectExecutor>()
    const runner = mock<NativeRunnerService>()
    const access = mock<AccountAttachmentsService>()
    const receipts = mock<ToolReceiptsService>()
    const requests = mock<NodeRequestsGate>()
    registry.installed.mockReturnValue({
        nodes: new Map(),
        effects: new Map(INSTALLED.nodeInstall().effects.map((effect) => [effect.id, effect])),
        tools: new Map(),
        dataKinds: new Map(),
    })
    registry.subjectResolvers.mockReturnValue([])
    registry.executorOf.mockReturnValue(executor)
    effects.once.mockImplementation((_workspace, _effect, _call, act) => act())
    tokens.mint.mockReturnValue("token-1")
    tokens.verify.mockReturnValue(CLAIMS)
    grants.listOfAgent.mockResolvedValue([])
    grants.agentsGranted.mockResolvedValue([])
    access.listOfAgent.mockResolvedValue([])
    access.listOfWorkspace.mockResolvedValue([])
    receipts.run.mockImplementation((_workspace, _key, operation) => operation())
    runner.run.mockResolvedValue({ kind: "ok", value: { armed: true } })
    requests.requestOf.mockResolvedValue(request)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            NodeToolDoorService,
            { provide: GRAPH_NODE_TOOL_DOOR, useExisting: NodeToolDoorService },
            ToolRegistryService,
            AgentAccountsService,
            { provide: AccountAttachmentsService, useValue: access },
            { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
            {
                provide: ConnectionBindingsReadService,
                useValue: { recordOf: () => Promise.resolve(null), ofProvider: () => Promise.resolve([]) },
            },
            { provide: ToolCallLogService, useValue: mock<ToolCallLogService>() },
            { provide: ToolReceiptsService, useValue: receipts },
            { provide: NativeRunnerService, useValue: runner },
            { provide: NATIVE_TOOL_FAMILIES, useValue: [mock<NativeToolFamily>({ manifest: NATIVE })] },
            { provide: TOOLS_OPTIONS, useValue: { defaultTimeoutMs: 1000 } },
            { provide: ToolGrantsService, useValue: grants },
            { provide: NODE_REQUESTS_GATE, useValue: requests },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: mock<Required<NodeModelDoor>>() },
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService), executor, runner, requests }
}

/** The run of a shipped template node on its first example's input and policy. */
const runOf = (nodeId: string): NodeRunInput => {
    const node = INSTALLED.templateNodeOf(nodeId)
    if (node?.entry !== "template-node")
        throw new TestWorldError({
            code: TestWorldErrorCode.RowMissing,
            params: { what: `no template node ${nodeId}` },
        })
    const [example] = node.examples
    return {
        ...PROBE_RUN,
        nodeId,
        params: example?.params ?? {},
        input: example?.input ?? {},
        turn: { ...PROBE_RUN.turn, conversationId: null },
        grant: { tools: [] },
        key: `run-1:${nodeId}`,
    }
}

describe("a step whose node states no readable mode, on the template road (real host, real door)", () => {
    it("freezes sales.care-occasion-rearm: the typed not-granted error, never a refusal the node reads; nothing runs", async () => {
        const { host, executor, runner, requests } = await build(null)

        await expect(host.run(runOf("sales.care-occasion-rearm"))).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolNotGranted,
            params: { tool: TOOL.timerArm, reason: "node_mode_unknown" },
        })
        expect(runner.run).not.toHaveBeenCalled()
        expect(executor.execute).not.toHaveBeenCalled()
        expect(requests.requestOf).toHaveBeenCalledWith("ws-1", "a-1", CLAIMS.step)
    })

    // Ledger (ROAD Opus-1f, 2026-11-14): the second timer-arming node of this case, `sales.payment-reminder-arm`, is deleted (R28,
    // Opus-3f 06:17); the case above proves the same freeze on the timer-arming node that remains.
})

describe("a step whose node states `ask` (real host, real door)", () => {
    // Ledger (ROAD Opus-1f, 2026-11-14): proven on `sales.care-occasion-rearm` (the deleted `sales.payment-reminder-arm` armed the same timer).
    it("stops sales.care-occasion-rearm for a person: the typed approval error (`ask_mode`), never a refusal; nothing runs", async () => {
        const { host, executor, runner } = await build({ mode: "ask", accounts: [] })

        await expect(host.run(runOf("sales.care-occasion-rearm"))).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: { tool: TOOL.timerArm, reason: "ask_mode" },
        })
        expect(runner.run).not.toHaveBeenCalled()
        expect(executor.execute).not.toHaveBeenCalled()
    })
})
