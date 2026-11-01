import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { BridgeTurn } from "@modules/domain/agent-tools"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCallResult } from "@modules/domain/mcp-gateway"
import { toolResultOf } from "@modules/domain/intent-contracts"
import { AgentWriteRightService } from "./agent-write-right.service"
import { IntentTurnService } from "./intent-turn.service"
import { InternalGatewayToolsService } from "./internal-gateway-tools.service"

const turn = (over: Partial<BridgeTurn> = {}): BridgeTurn => ({
    jobId: "wake-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    turnId: "turn-1",
    wakeId: "wake-1",
    source: "internal",
    conversationId: null,
    authorUserId: null,
    ...over,
})

const caller = { workspaceId: "ws-1", agentId: "agent-1", conversationId: null, workItemId: null, turnId: "turn-1" }

type Described = NonNullable<Awaited<ReturnType<McpGatewayService["describe"]>>>

const READ: Described = {
    name: "sepay.transactions.debits",
    description: "Debits",
    scope: "read",
    mode: "auto",
    limitVnd: null,
    inputSchema: {},
    constraints: [],
}
const WRITE: Described = { ...READ, name: "sepay.pay", scope: "write" }

interface Options {
    readonly described?: Described | null
    readonly result?: GatewayCallResult
    readonly mayWrite?: boolean
    readonly pipeline?: boolean
}

const build = async ({
    described = READ,
    result = { ok: true, value: { rows: 2 } },
    mayWrite = true,
    pipeline = false,
}: Options = {}) => {
    const gateway = mock<McpGatewayService>({
        search: jest.fn(() => Promise.resolve([READ])),
        describe: jest.fn(() => Promise.resolve(described)),
        call: jest.fn(() => Promise.resolve(result)),
    })
    const right = mock<AgentWriteRightService>({ mayWrite: jest.fn(() => Promise.resolve(mayWrite)) })
    const intents = mock<IntentTurnService>({ pipelineOf: jest.fn(() => Promise.resolve(pipeline)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InternalGatewayToolsService,
            { provide: IntentTurnService, useValue: intents },
            { provide: McpGatewayService, useValue: gateway },
            { provide: AgentWriteRightService, useValue: right },
        ],
    }).compile()
    return { tools: moduleRef.get(InternalGatewayToolsService), gateway, right, intents }
}

describe("InternalGatewayToolsService > search and describe", () => {
    it("searches as the turn's own agent with no conversation, so the internal tools appear", async () => {
        const { tools, gateway } = await build()

        await expect(tools.run(turn(), "tool.search", { query: " debits ", limit: 3 })).resolves.toEqual({
            tools: [READ],
        })
        expect(gateway.search).toHaveBeenCalledWith(caller, "debits", 3)
    })

    it("hands the gateway the conversation of a turn that has one, so the tools only staff may run stay hidden from it", async () => {
        const { tools, gateway } = await build()

        await tools.run(turn({ source: "customer", conversationId: "conv-1" }), "tool.search", { query: "x" })

        expect(gateway.search).toHaveBeenCalledWith({ ...caller, conversationId: "conv-1" }, "x", 5)
    })

    it("asks for five tools when the agent names no limit", async () => {
        const { tools, gateway } = await build()

        await tools.run(turn(), "tool.search", { query: "x" })

        expect(gateway.search).toHaveBeenCalledWith(caller, "x", 5)
    })

    it("refuses a search the schema does not accept", async () => {
        const { tools, gateway } = await build()

        await expect(tools.run(turn(), "tool.search", { query: "x", extra: 1 })).resolves.toEqual({
            error: "invalid_arguments",
        })
        expect(gateway.search).not.toHaveBeenCalled()
    })

    it("describes a granted tool, and says so when it is unknown or not granted", async () => {
        const granted = await build()
        const missing = await build({ described: null })

        await expect(granted.tools.run(turn(), "tool.describe", { name: READ.name })).resolves.toMatchObject({
            name: READ.name,
        })
        await expect(missing.tools.run(turn(), "tool.describe", { name: "x.y" })).resolves.toEqual({
            error: "not_granted_or_unknown",
        })
        await expect(granted.tools.run(turn(), "tool.describe", {})).resolves.toEqual({ error: "invalid_arguments" })
    })

    it("does not run a playbook sequence, which a person approves for a conversation", async () => {
        const { tools } = await build()

        await expect(tools.run(turn(), "tool.sequence", {})).resolves.toEqual({ error: "needs_conversation" })
    })
})

describe("InternalGatewayToolsService > call", () => {
    it("runs a read tool under a step key of the wake, so a retried turn repeats nothing", async () => {
        const { tools, gateway } = await build()

        const answer = await tools.run(turn(), "tool.call", { name: READ.name, arguments_json: '{"day":"2026-11-10"}' })

        expect(answer).toEqual({ result: { rows: 2 } })
        const [given, name, args] = gateway.call.mock.calls[0] ?? []
        expect(given).toMatchObject(caller)
        expect(given?.opKey).toMatch(/^wake-1:sepay\.transactions\.debits:[0-9a-f]{16}$/u)
        expect(name).toBe(READ.name)
        expect(args).toEqual({ day: "2026-11-10" })
    })

    it("runs a tool with no arguments as an empty object", async () => {
        const { tools, gateway } = await build()

        await tools.run(turn(), "tool.call", { name: READ.name })
        await tools.run(turn(), "tool.call", { name: READ.name, arguments_json: "  " })

        expect(gateway.call.mock.calls.map(([, , args]) => args)).toEqual([{}, {}])
    })

    it("refuses arguments that are not a bounded JSON object, and a call the schema does not accept", async () => {
        const { tools, gateway } = await build()

        await expect(
            tools.run(turn(), "tool.call", { name: READ.name, arguments_json: "nope" }),
        ).resolves.toMatchObject({
            error: "invalid_arguments",
        })
        await expect(tools.run(turn(), "tool.call", { name: READ.name, arguments_json: "[1]" })).resolves.toMatchObject(
            {
                error: "invalid_arguments",
            },
        )
        await expect(tools.run(turn(), "tool.call", { arguments_json: "{}" })).resolves.toEqual({
            error: "invalid_arguments",
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("says so when the tool is not granted or unknown, without calling it", async () => {
        const { tools, gateway } = await build({ described: null })

        await expect(tools.run(turn(), "tool.call", { name: "x.y" })).resolves.toEqual({
            error: "not_granted_or_unknown",
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

describe("InternalGatewayToolsService > who may write", () => {
    it("asks the write right of the turn's source and author, and lets a call through that it grants", async () => {
        const { tools, gateway, right } = await build({ described: WRITE })

        await expect(
            tools.run(turn({ source: "tag", authorUserId: "user-1" }), "tool.call", { name: WRITE.name }),
        ).resolves.toEqual({ result: { rows: 2 } })
        expect(right.mayWrite).toHaveBeenCalledWith("tag", "user-1", "ws-1")
        expect(gateway.call).toHaveBeenCalledTimes(1)
    })

    it("refuses a write the right does not grant, and calls nothing: the agent proposes an action instead", async () => {
        const { tools, gateway } = await build({ described: WRITE, mayWrite: false })

        await expect(tools.run(turn({ source: "internal" }), "tool.call", { name: WRITE.name })).resolves.toEqual({
            error: "read_only_turn",
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("does not ask the right for a read tool", async () => {
        const { tools, right } = await build({ mayWrite: false })

        await tools.run(turn(), "tool.call", { name: READ.name })

        expect(right.mayWrite).not.toHaveBeenCalled()
    })
})

describe("InternalGatewayToolsService > what the gateway answers", () => {
    it("tells the agent when the grants hold the call for a person, so it proposes an action", async () => {
        const { tools } = await build({ result: { ok: false, code: "approval_required", reason: "over_limit_vnd" } })

        await expect(tools.run(turn(), "tool.call", { name: READ.name })).resolves.toEqual({
            error: "approval_required",
            reason: "over_limit_vnd",
        })
    })

    it("passes on why the gateway refused or failed", async () => {
        const { tools } = await build({ result: { ok: false, code: "not_granted", detail: "no grant" } })

        await expect(tools.run(turn(), "tool.call", { name: READ.name })).resolves.toEqual({
            error: "not_granted",
            detail: "no grant",
        })
    })
})

describe("InternalGatewayToolsService > the contract pipeline", () => {
    const tagTurn = (over: Partial<BridgeTurn> = {}): BridgeTurn =>
        turn({ source: "tag", authorUserId: "user-1", ...over })

    it("asks whether the turn is on the pipeline with the scope of the turn row", async () => {
        const { tools, intents } = await build({ pipeline: true })

        await tools.run(tagTurn({ pinnedIntent: "confirm_order" }), "tool.call", { name: READ.name })

        expect(intents.pipelineOf).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "tag",
            authorUserId: "user-1",
            pinned: "confirm_order",
        })
    })

    it("refuses a write of a turn that is not pinned: the write waits for a turn of its own", async () => {
        const { tools, gateway } = await build({ described: WRITE, pipeline: true })

        await expect(tools.run(tagTurn(), "tool.call", { name: WRITE.name })).resolves.toEqual({
            error: "needs_own_turn",
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("lets the turn pinned to an intent write", async () => {
        const { tools, gateway } = await build({ described: WRITE, pipeline: true })

        await expect(
            tools.run(tagTurn({ pinnedIntent: "pay_supplier" }), "tool.call", { name: WRITE.name }),
        ).resolves.toEqual({ result: toolResultOf({ rows: 2 }) })
        expect(gateway.call).toHaveBeenCalledTimes(1)
    })

    it("lets an unpinned turn read, and hands the result over as marked data", async () => {
        const { tools } = await build({ pipeline: true })

        await expect(tools.run(tagTurn(), "tool.call", { name: READ.name })).resolves.toEqual({
            result: toolResultOf({ rows: 2 }),
        })
    })

    it("keeps the refusal of a person who may not write ahead of the one for a turn of its own", async () => {
        const { tools } = await build({ described: WRITE, pipeline: true, mayWrite: false })

        await expect(tools.run(tagTurn(), "tool.call", { name: WRITE.name })).resolves.toEqual({
            error: "read_only_turn",
        })
    })

    it("leaves a turn with no contracts exactly as it was: a write goes through and the result is not wrapped", async () => {
        const { tools } = await build({ described: WRITE, pipeline: false })

        await expect(tools.run(tagTurn(), "tool.call", { name: WRITE.name })).resolves.toEqual({
            result: { rows: 2 },
        })
    })
})
