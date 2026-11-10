import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { EffectCall, NodeQuery } from "@nivo-lite/agent-sdk/node"
import { nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { TOOL, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import {
    GraphNodeRegistryService,
    type NodeDataPort,
    type NodeEffectExecutor,
    type NodeRow,
    type NodeTurn,
} from "@modules/domain/graph-nodes"
import { McpGatewayError, McpGatewayErrorCode, type GatewayJson } from "@modules/domain/mcp-gateway"
import { BankNativeService } from "@modules/domain/native-tools"
import { TeamChatAudienceService } from "@modules/domain/team-chat"
import { CLOCK } from "@modules/platform/clock"
import { DailyCloseEffectsService } from "./daily-close-effects.service"
import { isAnswerOf, isRowsOf } from "./daily-close.policy"
import { SalesEffectsErrorCode } from "./errors/sales-effects.error"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-accounting",
    subject: null,
    conversationId: null,
    locale: "en",
}
const CALL: EffectCall = { key: "run-1:report:0", dedupeKey: null }

/** One card the executor asked the team chat to post. */
type CardPost = Parameters<TeamChatAudienceService["postTeamCard"]>[1]

/** 21:00 on 9 November 2026 in the shop (UTC+7). */
const EVENING_9TH = "2026-11-09T14:00:00.000Z"
/** 21:00 on 30 November 2026 in the shop: the last evening of the month. */
const EVENING_30TH = "2026-11-30T14:00:00.000Z"

const credit = (id: string, amountVnd: number, occurredAt: string, changes: Partial<NodeRow> = {}): NodeRow => ({
    id,
    amountVnd,
    occurredAt,
    orderId: null,
    status: "unmatched",
    direction: "credit",
    externalRef: null,
    ...changes,
})

const BOOKS: ReadonlyArray<NodeRow> = [
    credit("t1", 480_000, "2026-11-09T03:00:00.000Z", {
        status: "matched",
        orderId: "order-lan",
        externalRef: "sepay-1",
    }),
    credit("t2", 70_000, "2026-11-09T06:00:00.000Z", { externalRef: "sepay-2" }),
    credit("t3", 999_000, "2026-11-08T03:00:00.000Z", {
        status: "matched",
        orderId: "order-old",
        externalRef: "sepay-0",
    }),
]

const movement = (id: string, amountVnd: number, occurredAt: string) => ({
    id,
    direction: "credit",
    amountVnd,
    content: "",
    occurredAt,
    bankName: "MB",
})

const BANK_MOVES = [
    movement("sepay-1", 480_000, "2026-11-09T03:00:00.000Z"),
    movement("sepay-2", 70_000, "2026-11-09T06:00:00.000Z"),
    movement("sepay-9", 20_000, "2026-11-09T07:00:00.000Z"),
]

/** The books by equality filters and the limit, as the engine's port answers them. */
const portOf = (kind: string): NodeDataPort =>
    mock<NodeDataPort>({
        kind,
        read: jest.fn((_turn: NodeTurn, query: NodeQuery) => {
            const rows = kind === "bank-transaction" ? BOOKS : []
            const kept = rows.filter((row) =>
                Object.entries(query.where ?? {}).every(([field, value]) => row[field] === value),
            )
            return Promise.resolve(kept.slice(0, query.limit ?? kept.length))
        }),
    })

/** The bank's own list for the window asked, or the refusal of a workspace with no live feed. */
const bankAnswer = (connected: boolean, args: GatewayJson): Promise<GatewayJson> => {
    if (!connected) {
        return Promise.reject(
            new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params: { reason: "not_connected" } }),
        )
    }
    const since = typeof args.since === "string" ? args.since : ""
    const until = typeof args.until === "string" ? args.until : ""
    return Promise.resolve({
        provider: "sepay",
        transactions: BANK_MOVES.filter((move) => move.occurredAt >= since && move.occurredAt <= until),
    })
}

/** The team chat's answer: each card lands in the founder's direct room and the agent's team room, or the line goes nowhere. */
const chatAnswer = (lines: Array<CardPost>, mode: "posted" | "lost", post: CardPost) => {
    if (mode === "lost") {
        return Promise.reject(new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params: {} }))
    }
    lines.push(post)
    return Promise.resolve({
        messageId: `msg-${String(lines.length)}`,
        facts: { requested: "own", roomId: "room-acc" },
    })
}

interface BuildOptions {
    readonly now?: string
    readonly bank?: "live" | "not_connected" | "absent"
    readonly chat?: "posted" | "lost"
}

const build = async (options: BuildOptions = {}) => {
    const lines: Array<CardPost> = []
    const registry = mock<GraphNodeRegistryService>({ portOf: jest.fn(portOf) })
    const bank = mock<BankNativeService>()
    bank.invoke.mockImplementation((_workspaceId, _tool, args) => bankAnswer(options.bank !== "not_connected", args))
    const chat = mock<TeamChatAudienceService>()
    chat.postTeamCard.mockImplementation((_workspaceId, post) => chatAnswer(lines, options.chat ?? "posted", post))
    const moduleRef = await Test.createTestingModule({
        providers: [
            DailyCloseEffectsService,
            { provide: CLOCK, useValue: new FakeClock(Date.parse(options.now ?? EVENING_9TH)) },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: TeamChatAudienceService, useValue: chat },
            ...(options.bank === "absent" ? [] : [{ provide: BankNativeService, useValue: bank }]),
        ],
    }).compile()
    moduleRef.get(DailyCloseEffectsService).onModuleInit()
    const executor: NodeEffectExecutor | undefined = registry.addExecutor.mock.calls[0]?.[0]
    assert(executor !== undefined, "no executor was registered")
    return { executor, lines, bank }
}

describe("DailyCloseEffectsService", () => {
    it("registers itself for the report.daily.close effect", async () => {
        expect((await build()).executor.effect).toBe(TOOL.reportDailyClose)
    })

    it("closes the day from the books and the bank, posts the card once for the day and answers the figures as facts", async () => {
        const { executor, lines, bank } = await build()

        const fact = await executor.execute(TURN, { day: "2026-11-09" }, CALL)

        expect(lines).toHaveLength(1)
        expect(lines[0]).toMatchObject({
            agentId: "agent-accounting",
            audience: "own",
            key: "agent-message:accounting-daily:2026-11-09",
            message: { kind: "report.accounting", intent: "report", payload: { period: "daily", partial: false } },
        })
        expect(bank.invoke).toHaveBeenCalledWith(
            "ws-1",
            "transactions",
            { since: "2026-11-08T17:00:00.000Z", until: "2026-11-09T16:59:59.999Z", limit: 50 },
            { agentId: "agent-accounting", conversationId: null },
        )
        expect(fact).toMatchObject({
            kind: "chat-message",
            id: "msg-1",
            facts: { day: "2026-11-09", close: "daily", messageIds: ["msg-1"], route: { roomId: "room-acc" } },
        })
        expect(JSON.stringify(fact)).toContain("550.000")
        expect(JSON.stringify(fact)).toContain("+20.000")
    })

    it("closes today in the shop's time when the agent names no day", async () => {
        const { executor, lines } = await build({ now: "2026-11-09T18:30:00.000Z" })
        await executor.execute(TURN, {}, CALL)
        expect(lines[0]?.key).toBe("agent-message:accounting-daily:2026-11-10")
    })

    it("posts the daily card and the month's reconciliation on the last evening of the month, each once for its period", async () => {
        const { executor, lines } = await build({ now: EVENING_30TH })
        const fact = await executor.execute(TURN, { day: "2026-11-30" }, CALL)
        expect(lines.map((one) => one.key)).toEqual([
            "agent-message:accounting-daily:2026-11-30",
            "agent-message:accounting-month:2026-11",
        ])
        expect(fact).toMatchObject({ facts: { close: "month-end", messageIds: ["msg-1", "msg-2"] } })
    })
})

describe("DailyCloseEffectsService refusals", () => {
    it("refuses a day after today and a day that does not exist, and posts nothing", async () => {
        const { executor, lines } = await build()
        await expect(executor.execute(TURN, { day: "2026-11-10" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "day_ahead",
            facts: { day: "2026-11-10", today: "2026-11-09" },
        })
        await expect(executor.execute(TURN, { day: "2026-02-31" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "day_invalid",
            facts: { day: "2026-02-31" },
        })
        expect(lines).toHaveLength(0)
    })

    it("refuses a workspace with no live bank feed, and one whose app serves no bank, and posts nothing", async () => {
        const offline = await build({ bank: "not_connected" })
        await expect(offline.executor.execute(TURN, { day: "2026-11-09" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "bank_not_connected",
            facts: { day: "2026-11-09" },
        })
        expect(offline.lines).toHaveLength(0)
        const absent = await build({ bank: "absent" })
        await expect(absent.executor.execute(TURN, {}, CALL)).resolves.toMatchObject({ id: "bank_not_connected" })
        expect(absent.lines).toHaveLength(0)
    })

    it("fails the step when the line goes nowhere", async () => {
        const lost = await build({ chat: "lost" })
        await expect(lost.executor.execute(TURN, { day: "2026-11-09" }, CALL)).rejects.toBeInstanceOf(McpGatewayError)
    })

    it("refuses a payload that is not the effect's shape", async () => {
        await expect((await build()).executor.execute(TURN, { day: "9/11/2026" }, CALL)).rejects.toMatchObject({
            code: SalesEffectsErrorCode.InvalidPayload,
        })
    })

    it("answers in a shape the accounting.report node's example runs with", async () => {
        const fact = await (await build()).executor.execute(TURN, { day: "2026-11-09" }, CALL)
        const node = coreNodes.find((one) => one.id === "accounting.report")
        const example = node?.examples?.[0]
        assert(node !== undefined, "the accounting.report node is not installed")
        assert(example !== undefined, "the accounting.report node has no example")
        const answers = { [TOOL.reportDailyClose]: [fact] }
        await expect(nodeExampleMismatches(node, { ...example, answers }, coreEffects, coreTools)).resolves.toEqual([])
    })
})

describe("daily close policy", () => {
    it("reads a list of records as rows and refuses anything else", () => {
        expect(isRowsOf([{ id: "t1" }])).toBe(true)
        expect(isRowsOf([{ id: "t1" }, "t2"])).toBe(false)
        expect(isRowsOf({ id: "t1" })).toBe(false)
    })

    it("reads a bank answer only when the bank tool's result schema accepts it", () => {
        const judge = { safeParse: (value: unknown) => ({ success: value === "ok" }) }
        expect(isAnswerOf("ok", judge)).toBe(true)
        expect(isAnswerOf("no", judge)).toBe(false)
    })
})
