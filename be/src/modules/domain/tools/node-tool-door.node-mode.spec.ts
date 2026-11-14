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
    toolFingerprintOf,
    type NodeEffectExecutor,
    type NodeEffectRun,
    type NodeToolRun,
} from "@modules/domain/graph-nodes"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { ToolReceiptsService } from "@modules/domain/tool-receipts"
import { AccountAttachmentsService, ToolGrantsService, type ToolGrantView } from "@modules/domain/tool-grants"
import type { NodeTurn } from "@modules/domain/graph-nodes"
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

// nivo-frame `rights` + `engineNoBusiness`, proved through the real door, the one runner, the real gateway and the real accounts reader:
// a node's DECLARED mode is the only mode. Three tools the old engine classed `money` (the settle, the ledger line, the invoice) run
// WITHOUT A STOP on a node declared `auto`; on `ask` they ask once and run after the yes (a person's no is the host's `declined`). An
// owner's old `never` grant row changes nothing (there is no `never` path). Nothing here reads a class, an amount or an order.

const NOW = "2026-11-13T08:00:00.000Z"
const STEP = { nodeKey: "do-it", versionId: "v-1", workflowId: "wf-1" }
const SETTLE = TOOL.agentTag
const LEDGER = TOOL.ledgerEntryAppend
const INVOICE = TOOL.invoiceCreate

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
    stepTools: [SETTLE, LEDGER, INVOICE],
}

/** One native connector serving the two tool-road tools as writes (what its manifest says: `scope: "write"`). */
const NATIVE: ToolManifest = {
    key: "books",
    namespace: "nivo",
    name: "Books",
    contractVersion: "1",
    tools: [LEDGER, INVOICE].map((full) => ({
        name: full.slice("nivo.".length),
        description: full,
        scope: "write" as const,
        inputSchema: { type: "object" },
        argumentSchema: z.record(z.string(), z.unknown()),
        defaultMode: "auto" as const,
        stepGranted: true,
    })),
}

/** The owner's old `never` rows: a concept the frame removed; nothing may read them as a decision. */
const NEVER_ROWS: ReadonlyArray<ToolGrantView> = [SETTLE, LEDGER, INVOICE].map((tool) => ({
    tool,
    mode: "never",
    limit_vnd: null,
    constraints: [],
}))

/**
 * The connections reader: no account here is an OpenAPI source (the invoice is issued at the e-invoice provider, MISA meInvoice, owner
 * ruling R57; before it the invoice rode a CRM account's pinned mark); no provider lists a connection of its own.
 */
const CONNECTIONS = {
    recordOf: () => Promise.resolve({ meta: {} }),
    ofProvider: () => Promise.resolve([]),
}

const build = async (mode: "auto" | "ask", rows: ReadonlyArray<ToolGrantView> = []) => {
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.verify.mockReturnValue(CLAIMS)
    const registry = mock<GraphNodeRegistryService>()
    const executor = mock<NodeEffectExecutor>({ effect: SETTLE })
    executor.execute.mockResolvedValue({ kind: "order", id: "order-1" })
    registry.executorOf.mockReturnValue(executor)
    const ledger = mock<GraphNodeEffectsService>()
    ledger.once.mockImplementation((_workspace, _effect, _call, act) => act())
    // The step's receipts as the real ledger answers them: none yet (a step's first attempt).
    ledger.recordsOf.mockResolvedValue([])
    const grants = mock<ToolGrantsService>()
    grants.listOfAgent.mockResolvedValue(rows)
    grants.agentsGranted.mockResolvedValue([])
    const access = mock<AccountAttachmentsService>()
    access.listOfAgent.mockResolvedValue([
        { agentId: "agent-1", connectionId: "c-google", provider: "google" },
        { agentId: "agent-1", connectionId: "c-misa", provider: "misa_meinvoice" },
    ])
    access.listOfWorkspace.mockResolvedValue([])
    const receipts = mock<ToolReceiptsService>()
    receipts.run.mockImplementation((_workspace, _key, operation) => operation())
    const runner = mock<NativeRunnerService>()
    runner.run.mockResolvedValue({ kind: "ok", value: { written: true } })
    const adapter = mock<NativeToolFamily>({ manifest: NATIVE })
    const requests = {
        requestOf: jest.fn().mockResolvedValue({
            mode,
            accounts: [
                { kind: "books", provider: "google", connectionId: null },
                { kind: "books", provider: "misa_meinvoice", connectionId: null },
            ],
        }),
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            ToolRegistryService,
            AgentAccountsService,
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: ledger },
            { provide: ToolGrantsService, useValue: grants },
            { provide: AccountAttachmentsService, useValue: access },
            { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
            { provide: ConnectionBindingsReadService, useValue: CONNECTIONS },
            { provide: ToolCallLogService, useValue: mock<ToolCallLogService>() },
            { provide: ToolReceiptsService, useValue: receipts },
            { provide: NativeRunnerService, useValue: runner },
            { provide: NATIVE_TOOL_FAMILIES, useValue: [adapter] },
            { provide: TOOLS_OPTIONS, useValue: { defaultTimeoutMs: 1000 } },
            { provide: NODE_REQUESTS_GATE, useValue: requests },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { door: moduleRef.get(NodeToolDoorService), executor, runner }
}

const TURN: NodeTurn = { turnId: "run-1", workspaceId: "ws-1", agentId: "agent-1", subject: null, conversationId: null, locale: "vi" }

const PAYLOAD = { orderId: "order-1", transactionId: "tx-1" }

const effectOf = (approval: { by: string; fingerprint: string } | null = null): NodeEffectRun => ({
    road: "effect",
    token: "token-1",
    effect: SETTLE,
    payload: PAYLOAD,
    call: { key: "run-1:do-it:1", dedupeKey: null },
    approval,
    turn: TURN,
    workflowStep: STEP,
    attempt: { step: "run-1:do-it", startedAt: NOW },
    refusals: "answer",
})

const toolOf = (tool: string, approval: { by: string; fingerprint: string } | null = null): NodeToolRun => ({
    road: "tool",
    token: "token-1",
    tool,
    args: { transactionId: "tx-1" },
    key: `run-1:do-it:${tool}`,
    approval,
    turn: TURN,
    workflowStep: STEP,
    refusals: "answer",
})

const askOf = (run: Promise<unknown>) =>
    run.then(
        () => null,
        (cause: unknown) => cause,
    )

describe("a node's declared mode is the only mode (door, runner, gateway)", () => {
    it("`auto`: the settle (once class money, its exact-settle floor gone) runs WITHOUT A STOP", async () => {
        const { door, executor } = await build("auto")

        await expect(door.run(effectOf())).resolves.toMatchObject({ road: "effect", subject: { id: "order-1" } })
        expect(executor.execute).toHaveBeenCalledTimes(1)
    })

    it("there is NO `never` path: an owner's old `never` row decides nothing, on both roads", async () => {
        const { door, executor, runner } = await build("auto", NEVER_ROWS)

        await expect(door.run(effectOf())).resolves.toMatchObject({ road: "effect" })
        await expect(door.run(toolOf(LEDGER))).resolves.toMatchObject({ road: "tool" })
        expect(executor.execute).toHaveBeenCalledTimes(1)
        expect(runner.run).toHaveBeenCalledTimes(1)
    })

    it.each([LEDGER, INVOICE])("`auto`: %s (once class money) runs WITHOUT A STOP on the tool road", async (tool) => {
        const { door, runner } = await build("auto")

        await expect(door.run(toolOf(tool))).resolves.toMatchObject({ road: "tool" })
        expect(runner.run).toHaveBeenCalledTimes(1)
    })

    it("`ask`: the settle asks ONCE, and runs after the person's yes (the approved replay of the same fingerprint)", async () => {
        const { door, executor } = await build("ask")

        const asked = await askOf(door.run(effectOf()))
        expect(asked).toMatchObject({ code: GraphNodesErrorCode.ToolApprovalRequired, params: { tool: SETTLE, reason: "ask_mode" } })
        expect(executor.execute).not.toHaveBeenCalled()

        const fingerprint = toolFingerprintOf(SETTLE, PAYLOAD)
        await expect(door.run(effectOf({ by: "owner-1", fingerprint }))).resolves.toMatchObject({ road: "effect" })
        expect(executor.execute).toHaveBeenCalledTimes(1)
    })

    it.each([
        [LEDGER, "c-google"],
        [INVOICE, "c-misa"],
    ])("`ask`: %s asks ONCE on the tool road (on %s), and runs after the yes", async (tool, account) => {
        const { door, runner } = await build("ask")

        const asked = await askOf(door.run(toolOf(tool)))
        expect(asked).toMatchObject({ code: GraphNodesErrorCode.ToolApprovalRequired, params: { tool } })
        expect(runner.run).not.toHaveBeenCalled()

        const params = asked !== null && typeof asked === "object" && "params" in asked ? asked.params : {}
        const fingerprint = typeof params === "object" && params !== null && "fingerprint" in params ? String(params.fingerprint) : ""
        const connectionId = typeof params === "object" && params !== null && "connectionId" in params ? String(params.connectionId) : ""
        expect(connectionId).toBe(account)
        await expect(door.run(toolOf(tool, { by: "owner-1", fingerprint }))).resolves.toMatchObject({ road: "tool" })
        expect(runner.run).toHaveBeenCalledTimes(1)
    })
})

describe("the customer send asks like every other tool: the node's mode at the call, then the approved call runs once", () => {
    const WORDS = { text: "Chào chị, đơn của chị giao trong ngày." }

    const sendOf = (payload: Readonly<Record<string, unknown>>, approval: { by: string; fingerprint: string } | null = null): NodeToolRun => ({
        ...effectOf(approval),
        effect: TOOL.customerMessageSend,
        payload,
    })

    it("`auto`: the send reaches its executor with no stop (the executor judges the attachment to the account)", async () => {
        const { door, executor } = await build("auto")

        await expect(door.run(sendOf(WORDS))).resolves.toMatchObject({ road: "effect" })
        expect(executor.execute).toHaveBeenCalledTimes(1)
    })

    it("`ask`: the send raises the approval BEFORE the executor, carrying its words, and runs once after the person's yes", async () => {
        const { door, executor } = await build("ask")

        const asked = await askOf(door.run(sendOf(WORDS)))
        expect(asked).toMatchObject({
            code: GraphNodesErrorCode.ToolApprovalRequired,
            params: { tool: TOOL.customerMessageSend, reason: "ask_mode", args: expect.stringContaining("Chào chị") },
        })
        expect(executor.execute).not.toHaveBeenCalled()

        const fingerprint = toolFingerprintOf(TOOL.customerMessageSend, WORDS)
        await expect(door.run(sendOf(WORDS, { by: "owner-1", fingerprint }))).resolves.toMatchObject({ road: "effect" })
        expect(executor.execute).toHaveBeenCalledTimes(1)
    })

    it("`ask`: the approval error carries the whole message (a 2,000-character text and the pictures' addresses), beyond the short words of the call", async () => {
        const { door } = await build("ask")
        const text = "Dạ chị ơi, đơn của chị đã xong. ".repeat(70).slice(0, 2000)
        const images = [{ url: "https://img.example/qr.png", caption: "QR" }]

        const asked = await askOf(door.run(sendOf({ text, images })))

        const params = asked !== null && typeof asked === "object" && "params" in asked ? asked.params : {}
        const content: unknown = typeof params === "object" && params !== null && "content" in params ? JSON.parse(String(params.content)) : null
        expect(content).toEqual([
            { name: "text", kind: "text", value: text },
            { name: "images", kind: "address", value: "https://img.example/qr.png" },
        ])
    })

    it("`ask`: words the model rewrote after the yes are another call, asked on a new approval and never run unapproved", async () => {
        const { door, executor } = await build("ask")
        const approved = { by: "owner-1", fingerprint: toolFingerprintOf(TOOL.customerMessageSend, WORDS) }

        const asked = await askOf(door.run(sendOf({ text: "Dạ đơn của chị giao trong ngày ạ." }, approved)))

        expect(asked).toMatchObject({ code: GraphNodesErrorCode.ToolApprovalRequired, params: { tool: TOOL.customerMessageSend } })
        expect(executor.execute).not.toHaveBeenCalled()
    })
})
