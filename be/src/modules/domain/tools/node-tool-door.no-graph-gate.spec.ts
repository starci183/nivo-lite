import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import {
    GraphNodeEffectsService,
    GraphNodeRegistryService,
    GraphNodeRunTokensService,
    GraphNodesErrorCode,
    type NodeTurn,
    type NodeToolRun,
} from "@modules/domain/graph-nodes"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { ToolReceiptsService } from "@modules/domain/tool-receipts"
import { AccountAttachmentsService, ToolGrantsService } from "@modules/domain/tool-grants"
import { AgentGraphsService } from "@modules/domain/agent-graphs/agent-graphs.service"
import type { GraphState } from "@modules/domain/agent-graphs/agent-graphs.service"
import type { GraphDocument, GraphNode } from "@modules/domain/agent-graphs/agent-graphs.contracts"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { z } from "zod"
import type { StepClaims } from "./tool-run.policy"
import type { NativeToolFamily, ToolManifest } from "./tools.contracts"
import { TOOLS_OPTIONS, NATIVE_TOOL_FAMILIES } from "./tools.decorators"
import { ToolRegistryService } from "./tool-registry.service"
import { NativeRunnerService } from "./native-runner.service"
import { NODE_REQUESTS_GATE } from "./node-requests.decorators"
import { NodeToolDoorService } from "./node-tool-door.service"
import { AgentAccountsService } from "./agent-accounts.service"

// Owner's final rule (TOOLS-LEAD, 2026-11-13, F3): the engine holds NO gate of its own. A node's DECLARED mode is the only mode:
// `auto` runs, `ask` interrupts ONCE through the runner. An agent that carries a seeded, ENFORCED `@1` graph with a decide point on
// `gateway_call` (the chatbot's old authority action) changes nothing: no graph is consulted on a node's tool call.

const NOW = "2026-11-13T08:00:00.000Z"
const STEP = { nodeKey: "do-it", versionId: "v-1", workflowId: "wf-1" }
const LEDGER = TOOL.ledgerEntryAppend

const CLAIMS: StepClaims = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    runId: "run-1",
    conversationId: null,
    origin: "system",
    memberId: null,
    scope: "workspace",
    expiresAt: 9_999_999_999_999,
    step: STEP,
    locale: "vi",
    stepTools: [LEDGER],
}

/** One native connector serving the ledger line as a write. */
const NATIVE: ToolManifest = {
    key: "books",
    namespace: "nivo",
    name: "Books",
    contractVersion: "1",
    tools: [
        {
            name: LEDGER.slice("nivo.".length),
            description: LEDGER,
            scope: "write" as const,
            inputSchema: { type: "object" },
            argumentSchema: z.record(z.string(), z.unknown()),
            defaultMode: "auto" as const,
            stepGranted: true,
        },
    ],
}

const CONNECTIONS = {
    recordOf: () => Promise.resolve({ meta: {} }),
    ofProvider: () => Promise.resolve([]),
}

const nodeOf = (key: string, extra: Partial<GraphNode>): GraphNode => ({
    key,
    kind: "condition",
    step: "evaluate",
    title: key,
    doneBy: "nivo",
    knows: [],
    does: key,
    uses: [],
    reads: [],
    writes: [],
    approver: null,
    sources: [{ kind: "rule", action: "gateway_call" }],
    none: [],
    next: [],
    ...extra,
})

/** The seeded `@1` graph of an agent: a decide point on `gateway_call` whose only branch asks a person. */
const SEEDED: GraphDocument = {
    nodes: [
        nodeOf("decide:gateway_call", {
            decide: {
                intent: "gateway_call",
                facts: [],
                branches: [{ key: "else", when: "else", mode: "ask", next: "act:gateway_call", approver: null, sources: [] }],
            },
        }),
        nodeOf("act:gateway_call", { kind: "execute", step: "write", action: "gateway_call" }),
    ],
} as unknown as GraphDocument

const STATE: GraphState = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    installationId: "inst-1",
    mode: "enforced",
    draft: SEEDED,
    draftRev: 1,
    activeVersionId: "graph-v-1",
    active: SEEDED,
    activeKind: "seed",
}

const build = async (mode: "auto" | "ask") => {
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.verify.mockReturnValue(CLAIMS)
    const grants = mock<ToolGrantsService>()
    grants.listOfAgent.mockResolvedValue([])
    grants.agentsGranted.mockResolvedValue([])
    const access = mock<AccountAttachmentsService>()
    access.listOfAgent.mockResolvedValue([{ agentId: "agent-1", connectionId: "c-google", provider: "google" }])
    access.listOfWorkspace.mockResolvedValue([])
    const receipts = mock<ToolReceiptsService>()
    receipts.run.mockImplementation((_workspace, _key, operation) => operation())
    const runner = mock<NativeRunnerService>()
    runner.run.mockResolvedValue({ kind: "ok", value: { written: true } })
    const graphs = mock<AgentGraphsService>()
    graphs.stateOfAgent.mockResolvedValue(STATE)
    graphs.stateOfInstallation.mockResolvedValue(STATE)
    const requests = {
        requestOf: jest.fn().mockResolvedValue({
            mode,
            accounts: [{ kind: "books", provider: "google", connectionId: null }],
        }),
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            ToolRegistryService,
            AgentAccountsService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: GraphNodeRegistryService, useValue: mock<GraphNodeRegistryService>() },
            { provide: GraphNodeEffectsService, useValue: mock<GraphNodeEffectsService>() },
            { provide: ToolGrantsService, useValue: grants },
            { provide: AccountAttachmentsService, useValue: access },
            { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
            { provide: ConnectionBindingsReadService, useValue: CONNECTIONS },
            { provide: ToolCallLogService, useValue: mock<ToolCallLogService>() },
            { provide: ToolReceiptsService, useValue: receipts },
            { provide: NativeRunnerService, useValue: runner },
            { provide: NATIVE_TOOL_FAMILIES, useValue: [mock<NativeToolFamily>({ manifest: NATIVE })] },
            { provide: TOOLS_OPTIONS, useValue: { defaultTimeoutMs: 1000 } },
            { provide: NODE_REQUESTS_GATE, useValue: requests },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { door: moduleRef.get(NodeToolDoorService), runner, graphs }
}

const TURN: NodeTurn = { turnId: "run-1", workspaceId: "ws-1", agentId: "agent-1", subject: null, conversationId: null, locale: "vi" }

const toolOf = (approval: { by: string; fingerprint: string } | null = null): NodeToolRun => ({
    road: "tool",
    token: "token-1",
    tool: LEDGER,
    args: { transactionId: "tx-1" },
    key: `run-1:do-it:${LEDGER}`,
    approval,
    turn: TURN,
    workflowStep: STEP,
    refusals: "answer",
})

const caught = (run: Promise<unknown>): Promise<unknown> =>
    run.then(
        () => null,
        (cause: unknown) => cause,
    )

const paramOf = (error: unknown, key: string): string => {
    const params = error !== null && typeof error === "object" && "params" in error ? error.params : {}
    return typeof params === "object" && params !== null && key in params ? String((params as Record<string, unknown>)[key]) : ""
}

describe("no engine gate: a node's declared mode alone decides a write, whatever graph the agent carries (door, registry)", () => {
    it("`auto` on an agent with a seeded enforced `@1` graph deciding `gateway_call`: the write RUNS, no graph is read", async () => {
        const { door, runner, graphs } = await build("auto")

        await expect(door.run(toolOf())).resolves.toMatchObject({ road: "tool" })
        expect(runner.run).toHaveBeenCalledTimes(1)
        expect(graphs.stateOfAgent).not.toHaveBeenCalled()
    })

    it("`ask`: the write interrupts ONCE through the runner (`ask_mode`, never `graph_ask`), and runs after the person's yes", async () => {
        const { door, runner, graphs } = await build("ask")

        const asked = await caught(door.run(toolOf()))
        expect(asked).toMatchObject({ code: GraphNodesErrorCode.ToolApprovalRequired, params: { tool: LEDGER, reason: "ask_mode" } })
        expect(runner.run).not.toHaveBeenCalled()

        await expect(door.run(toolOf({ by: "owner-1", fingerprint: paramOf(asked, "fingerprint") }))).resolves.toMatchObject({
            road: "tool",
        })
        expect(runner.run).toHaveBeenCalledTimes(1)
        expect(graphs.stateOfAgent).not.toHaveBeenCalled()
    })
})
