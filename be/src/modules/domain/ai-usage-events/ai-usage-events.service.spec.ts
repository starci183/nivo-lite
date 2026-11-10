import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, withRunScope, withWorkScope } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QuotaRecord, QuotaStatus, UsageInput, UsageKind } from "./ai-usage-events.contracts"
import { AiUsageEventsLogEvent } from "./ai-usage-events.log-events"
import { CREDIT_USD_VALUE } from "./usage-cost.policy"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { AiUsageEventEntity } from "./persistence/entities"

const SELECT_QUOTA_STATUS = 'SELECT * FROM "public"."ai_quota_status"($1)'
const POST_USAGE_NOTICE = 'SELECT * FROM "public"."usage_notice_post"($1, $2, $3, $4)'
/** The row as the driver answers it: bigint and numeric columns as text. */
const ROW: QuotaRecord = {
    period_start: "2026-10-01",
    messages_used: "80",
    tokens_used: "1000",
    cost_usd: "0.4",
    messages_limit: 100,
    tokens_limit: "10000",
    fallback_reply: "  Vui l\u00f2ng ch\u1edd  ",
    credits_used: "100",
    credits_limit: "200",
    credits_carried: "20",
    topup_balance: "50",
}
const STATUS: QuotaStatus = {
    periodStart: "2026-10-01",
    messagesUsed: 80,
    tokensUsed: 1000,
    costUsd: 0.4,
    messagesLimit: 100,
    tokensLimit: 10000,
    fallbackReply: "Vui l\u00f2ng ch\u1edd",
    creditsUsed: 100,
    creditsLimit: 200,
    creditsCarried: 20,
    topupBalance: 50,
    messagesExceeded: false,
    tokensExceeded: false,
    creditsExceeded: false,
    ratio: 0.8,
    level: "warn",
}
const INPUT: UsageInput = {
    workspaceId: "ws-1",
    kind: "chat_reply",
    module: "sales",
    model: "deepseek-chat",
    usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.0123456789 },
    promptChars: 300,
    completionChars: 60,
}
const WARN_BODY =
    "M\u1ee9c d\u00f9ng AI th\u00e1ng n\u00e0y \u0111\u00e3 \u0111\u1ea1t 80% h\u1ea1n m\u1ee9c (100/200 credit, 50 credit n\u1ea1p th\u00eam c\u00f2n l\u1ea1i, 80/100 tin nh\u1eafn, " +
    "1.000/10.000 token). Khi h\u1ebft h\u1ea1n m\u1ee9c, chatbot s\u1ebd chuy\u1ec3n c\u00e2u h\u1ecfi c\u1ee7a kh\u00e1ch cho nh\u00e2n vi\u00ean thay v\u00ec t\u1ef1 tr\u1ea3 " +
    "l\u1eddi. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing)."
const EXCEEDED_BODY =
    "Workspace \u0111\u00e3 d\u00f9ng h\u1ebft h\u1ea1n m\u1ee9c AI c\u1ee7a th\u00e1ng n\u00e0y (100/200 credit, 50 credit n\u1ea1p th\u00eam c\u00f2n l\u1ea1i, 100/100 tin " +
    "nh\u1eafn, 1.000/10.000 token). Chatbot t\u1ea1m d\u1eebng t\u1ef1 tr\u1ea3 l\u1eddi: kh\u00e1ch nh\u1eadn l\u1eddi x\u00e1c nh\u1eadn l\u1ecbch s\u1ef1 v\u00e0 c\u00e2u h\u1ecfi \u0111\u01b0\u1ee3c " +
    "chuy\u1ec3n cho nh\u00e2n vi\u00ean. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing) \u0111\u1ec3 chatbot ho\u1ea1t " +
    "\u0111\u1ed9ng l\u1ea1i."

const build = async (entityManager: MockEntityManager) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiUsageEventsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { usage: moduleRef.get(AiUsageEventsService), logger }
}

describe("AiUsageEventsService", () => {
    it("reads the browser quota without swallowing database failures", async () => {
        const em = mockEntityManager()
        const failure = new Error("quota read failed")
        em.query.mockResolvedValueOnce([ROW]).mockResolvedValueOnce([]).mockRejectedValueOnce(failure)
        const { usage, logger } = await build(em)

        await expect(usage.readQuotaStatus("ws-1")).resolves.toEqual(STATUS)
        await expect(usage.readQuotaStatus("ws-2")).resolves.toBeNull()
        await expect(usage.readQuotaStatus("ws-3")).rejects.toBe(failure)
        expect(em.query.mock.calls).toEqual([
            [SELECT_QUOTA_STATUS, ["ws-1"]],
            [SELECT_QUOTA_STATUS, ["ws-2"]],
            [SELECT_QUOTA_STATUS, ["ws-3"]],
        ])
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("maps monthly rollups with the quota into the billing summary", async () => {
        const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, [ROW]] })
        const monthly = fakeQueryBuilder({
            getRawMany: [{ day: "2026-10-02", module: "sales", calls: 2, tokens: 40, cost_usd: 0.00113 }],
        })
        em.createQueryBuilder.mockReturnValue(monthly.builder)
        const { usage } = await build(em)

        await expect(usage.usageSummary("ws-1")).resolves.toEqual({
            status: STATUS,
            byModule: [{ module: "sales", calls: 2, tokens: 40, costUsd: 0.00113, credits: 1 }],
            daily: [{ day: "2026-10-02", tokens: 40, credits: 1 }],
        })
        expect(em.query.mock.calls).toEqual([[SELECT_QUOTA_STATUS, ["ws-1"]]])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AiUsageEventEntity, "e")
        expect(monthly.callsOf("where")).toEqual([["e.workspace_id = :workspaceId", { workspaceId: "ws-1" }]])
        expect(monthly.callsOf("limit")).toEqual([[2000]])
    })

    it("reads recent cost from the requested day and defaults an absent row to zero", async () => {
        const em = mockEntityManager()
        const first = fakeQueryBuilder({ getRawOne: { cost_usd: 0.42 } })
        const second = fakeQueryBuilder({ getRawOne: undefined })
        em.createQueryBuilder.mockReturnValueOnce(first.builder).mockReturnValueOnce(second.builder)
        const { usage } = await build(em)

        await expect(usage.recentCostUsd("ws-1", "2026-10-01")).resolves.toBe(0.42)
        await expect(usage.recentCostUsd("ws-2", "2026-10-02")).resolves.toBe(0)
        expect(first.callsOf("andWhere")[1]).toEqual([expect.stringContaining(":from"), { from: "2026-10-01" }])
        expect(second.callsOf("andWhere")[1]).toEqual([expect.stringContaining(":from"), { from: "2026-10-02" }])
    })
})

describe("AiUsageEventsService > creditsUsedBy", () => {
    it("sums the whole credits a module used, at the value of one credit", async () => {
        const em = mockEntityManager()
        const sums = fakeQueryBuilder({ getRawOne: { credits: 7 } })
        em.createQueryBuilder.mockReturnValue(sums.builder)
        const { usage } = await build(em)

        await expect(usage.creditsUsedBy("ws-1", "video", 30)).resolves.toBe(7)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(AiUsageEventEntity, "u")
        expect(sums.callsOf("select")).toEqual([["COALESCE(sum(ceil(u.cost_usd / :creditUsd)), 0)::int", "credits"]])
        expect(sums.callsOf("where")).toEqual([
            [
                "u.workspace_id = :workspaceId AND u.module = :module AND u.failure IS NULL",
                { workspaceId: "ws-1", module: "video", creditUsd: CREDIT_USD_VALUE },
            ],
        ])
        expect(sums.callsOf("andWhere")).toEqual([
            ["u.created_at >= now() - CAST(:days AS integer) * interval '1 day'", { days: 30 }],
        ])
    })

    it("answers zero credits when no row comes back", async () => {
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ getRawOne: undefined }).builder)
        const { usage } = await build(em)

        await expect(usage.creditsUsedBy("ws-1", "video", 30)).resolves.toBe(0)
    })
})

describe("AiUsageEventsService > creditsByModule", () => {
    it("groups the whole credits of a period by module, the guide left out", async () => {
        const em = mockEntityManager()
        const sums = fakeQueryBuilder({
            getRawMany: [
                { module: "sales", credits: 210 },
                { module: "chatbot", credits: 380 },
            ],
        })
        em.createQueryBuilder.mockReturnValue(sums.builder)
        const { usage } = await build(em)
        const from = new Date("2026-11-02T17:00:00.000Z")
        const to = new Date("2026-11-09T17:00:00.000Z")

        const credits = await usage.creditsByModule("ws-1", from, to)

        expect([...credits]).toEqual([
            ["sales", 210],
            ["chatbot", 380],
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AiUsageEventEntity, "u")
        expect(sums.callsOf("andWhere")).toEqual([["u.created_at >= :from AND u.created_at < :to", { from, to }]])
        expect(sums.callsOf("groupBy")).toEqual([["1"]])
    })
})

const BOOKED = (overrides: Record<string, unknown> = {}) => ({
    workspaceId: "ws-1",
    kind: "chat_reply",
    module: "sales",
    model: "deepseek-chat",
    promptTokens: 100,
    completionTokens: 20,
    cachedTokens: 0,
    costUsd: "0.01234568",
    estimated: false,
    runId: null,
    purpose: null,
    reasoningTokens: 0,
    durationMs: null,
    tryNumber: null,
    upstream: null,
    finishReason: null,
    declaredModel: null,
    modelProvider: null,
    modelReason: null,
    workKind: null,
    workRef: null,
    stepKey: null,
    agentId: null,
    cacheWriteTokens: 0,
    failure: null,
    ...overrides,
})

describe("AiUsageEventsService > record", () => {
    it("books provider figures, truncates the model name and posts the monthly warning", async () => {
        const em = mockEntityManager({
            insert: [AiUsageEventEntity, {}],
            query: [
                [SELECT_QUOTA_STATUS, [ROW]],
                [POST_USAGE_NOTICE, [{ posted: true }]],
            ],
        })
        const { usage, logger } = await build(em)

        await expect(usage.record({ ...INPUT, model: "x".repeat(121) })).resolves.toBeUndefined()

        expect(em.insert.mock.calls).toEqual([[AiUsageEventEntity, BOOKED({ model: "x".repeat(120) })]])
        expect(em.query.mock.calls).toEqual([
            [SELECT_QUOTA_STATUS, ["ws-1"]],
            [POST_USAGE_NOTICE, ["ws-1", "2026-10-01", "warn", WARN_BODY]],
        ])
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("books estimated figures and sends no notice when no quota row is returned", async () => {
        const em = mockEntityManager({ insert: [AiUsageEventEntity, {}], query: [SELECT_QUOTA_STATUS, []] })
        const { usage, logger } = await build(em)

        await expect(usage.record({ ...INPUT, usage: null })).resolves.toBeUndefined()

        expect(em.insert.mock.calls).toEqual([[AiUsageEventEntity, BOOKED({ costUsd: "0.0000196", estimated: true })]])
        expect(em.query.mock.calls).toEqual([[SELECT_QUOTA_STATUS, ["ws-1"]]])
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("sends no notice for a quota below its warning level", async () => {
        const em = mockEntityManager({
            insert: [AiUsageEventEntity, {}],
            query: [SELECT_QUOTA_STATUS, [{ ...ROW, messages_used: "10" }]],
        })
        const { usage, logger } = await build(em)

        await expect(usage.record(INPUT)).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("metering: books what the call was and how it went beside its figures (kind, hidden reasoning, time, try, upstream)", async () => {
        const em = mockEntityManager({ insert: [AiUsageEventEntity, {}], query: [SELECT_QUOTA_STATUS, []] })
        const { usage } = await build(em)
        const call = {
            purpose: "accounting.match-payment:agent",
            reasoningTokens: 18,
            durationMs: 4_572,
            tryNumber: 2,
            upstream: "Parasail",
            finishReason: "stop",
        }

        await usage.record({ ...INPUT, call })

        expect(em.insert.mock.calls).toEqual([[AiUsageEventEntity, BOOKED(call)]])
    })

    it("work: books the work in scope (a node's step and agent), or the work the caller names, and the cache writes told", async () => {
        const em = mockEntityManager({ insert: [AiUsageEventEntity, {}], query: [SELECT_QUOTA_STATUS, []] })
        const { usage } = await build(em)
        const agentId = "0b6f6c2e-1111-4222-8333-444455556666"

        await withWorkScope({ kind: "node", stepKey: "match", agentId }, () =>
            usage.record({ ...INPUT, usage: { ...INPUT.usage, cache_write_tokens: 1_200 } }),
        )
        await usage.record({ ...INPUT, work: { kind: "learning", ref: "lesson:c-1" } })

        expect(em.insert.mock.calls).toEqual([
            [AiUsageEventEntity, BOOKED({ workKind: "node", stepKey: "match", agentId, cacheWriteTokens: 1_200 })],
            [AiUsageEventEntity, BOOKED({ workKind: "learning", workRef: "lesson:c-1" })],
        ])
    })

    it("a FAILED try: booked estimated with the prompt counted and no output, priced at its model, flagged with its failure", async () => {
        const em = mockEntityManager({ insert: [AiUsageEventEntity, {}], query: [SELECT_QUOTA_STATUS, []] })
        const { usage } = await build(em)

        await usage.record({
            ...INPUT,
            model: "claude-sonnet-5-5",
            usage: null,
            promptChars: 30_000,
            completionChars: 0,
            failure: "timeout",
            call: {
                purpose: "accounting.match-payment:agent",
                reasoningTokens: null,
                durationMs: null,
                tryNumber: 1,
                upstream: null,
                finishReason: null,
            },
        })

        // 30,000 characters = 10,000 tokens at Sonnet's $2 per million input: 0.02 USD, never billed (the billing SQL skips failures).
        expect(em.insert.mock.calls).toEqual([
            [
                AiUsageEventEntity,
                BOOKED({
                    model: "claude-sonnet-5-5",
                    promptTokens: 10_000,
                    completionTokens: 0,
                    costUsd: "0.02",
                    estimated: true,
                    failure: "timeout",
                    purpose: "accounting.match-payment:agent",
                    tryNumber: 1,
                }),
            ],
        ])
    })

    it("logs a write failure without failing the model reply or reading its quota", async () => {
        const em = mockEntityManager()
        const failure = new Error("usage insert failed")
        em.insert.mockRejectedValueOnce(failure)
        const { usage, logger } = await build(em)

        await expect(usage.record(INPUT)).resolves.toBeUndefined()

        expect(em.query).not.toHaveBeenCalled()
        expect(logger.error.mock.calls).toEqual([
            [AiUsageEventsLogEvent.RecordFailed, failure, { workspaceId: "ws-1" }],
        ])
    })
})

describe("AiUsageEventsService > record", () => {
    it("keeps a successfully booked call when reading its quota fails", async () => {
        const em = mockEntityManager({ insert: [AiUsageEventEntity, {}] })
        const failure = new Error("quota read failed")
        em.query.mockRejectedValueOnce(failure)
        const { usage, logger } = await build(em)

        await expect(usage.record(INPUT)).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(logger.error.mock.calls).toEqual([
            [AiUsageEventsLogEvent.StatusFailed, failure, { workspaceId: "ws-1" }],
        ])
    })
})

describe("AiUsageEventsService > quotaStatus", () => {
    it("maps the monthly row, including its trimmed fallback, pool ratio and warning", async () => {
        const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, [ROW]] })
        const { usage, logger } = await build(em)

        await expect(usage.quotaStatus("ws-1")).resolves.toEqual(STATUS)

        expect(em.query.mock.calls).toEqual([[SELECT_QUOTA_STATUS, ["ws-1"]]])
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("answers null for an absent row", async () => {
        const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, []] })
        const { usage, logger } = await build(em)

        await expect(usage.quotaStatus("ws-1")).resolves.toBeNull()

        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs a failed quota lookup and lets the call proceed", async () => {
        const em = mockEntityManager()
        const failure = new Error("quota unavailable")
        em.query.mockRejectedValueOnce(failure)
        const { usage, logger } = await build(em)

        await expect(usage.quotaStatus("ws-1")).resolves.toBeNull()

        expect(logger.error.mock.calls).toEqual([
            [AiUsageEventsLogEvent.StatusFailed, failure, { workspaceId: "ws-1" }],
        ])
    })
})

describe("AiUsageEventsService > blockedBy", () => {
    it.each<[UsageKind, boolean]>([
        ["guide", false],
        ["guide", true],
        ["embedding", false],
    ])("never reads or blocks a %s call with bulk=%s", async (kind, bulk) => {
        const em = mockEntityManager()
        const { usage, logger } = await build(em)

        await expect(usage.blockedBy("ws-1", kind, bulk)).resolves.toBeNull()

        expect(em.query).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("lets a call proceed when its quota is unavailable", async () => {
        const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, []] })
        const { usage } = await build(em)

        await expect(usage.blockedBy("ws-1", "chat_reply", false)).resolves.toBeNull()

        expect(em.query.mock.calls).toEqual([[SELECT_QUOTA_STATUS, ["ws-1"]]])
    })

    it("lets a customer call proceed below its limits", async () => {
        const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, [ROW]] })
        const { usage } = await build(em)

        await expect(usage.blockedBy("ws-1", "chat_reply", false)).resolves.toBeNull()

        expect(em.query.mock.calls).toEqual([[SELECT_QUOTA_STATUS, ["ws-1"]]])
    })

    it.each<UsageKind>(["chat_reply", "relay"])(
        "blocks %s when the message allowance is spent and tells the owner",
        async (kind) => {
            const em = mockEntityManager({
                query: [
                    [SELECT_QUOTA_STATUS, [{ ...ROW, messages_used: "100" }]],
                    [POST_USAGE_NOTICE, [{ posted: true }]],
                ],
            })
            const { usage, logger } = await build(em)

            await expect(usage.blockedBy("ws-1", kind, false)).resolves.toEqual({
                ...STATUS,
                messagesUsed: 100,
                messagesExceeded: true,
                ratio: 1,
                level: "exceeded",
            })

            expect(em.query.mock.calls).toEqual([
                [SELECT_QUOTA_STATUS, ["ws-1"]],
                [POST_USAGE_NOTICE, ["ws-1", "2026-10-01", "exceeded", EXCEEDED_BODY]],
            ])
            expect(logger.error).not.toHaveBeenCalled()
        },
    )

    it("lets bulk embeddings proceed when only messages are exhausted", async () => {
        const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, [{ ...ROW, messages_used: "100" }]] })
        const { usage } = await build(em)

        await expect(usage.blockedBy("ws-1", "embedding", true)).resolves.toBeNull()

        expect(em.query.mock.calls).toEqual([[SELECT_QUOTA_STATUS, ["ws-1"]]])
    })
})

describe("AiUsageEventsService > blockedBy", () => {
    it("blocks bulk embeddings at the credit limit even when posting the owner notice fails", async () => {
        const em = mockEntityManager()
        const failure = new Error("notice unavailable")
        em.query.mockResolvedValueOnce([{ ...ROW, credits_used: 200, topup_balance: 0 }]).mockRejectedValueOnce(failure)
        const { usage, logger } = await build(em)

        await expect(usage.blockedBy("ws-1", "embedding", true)).resolves.toEqual({
            ...STATUS,
            creditsUsed: 200,
            topupBalance: 0,
            creditsExceeded: true,
            ratio: 1,
            level: "exceeded",
        })

        expect(em.query.mock.calls).toEqual([
            [SELECT_QUOTA_STATUS, ["ws-1"]],
            [
                POST_USAGE_NOTICE,
                [
                    "ws-1",
                    "2026-10-01",
                    "exceeded",
                    "Workspace \u0111\u00e3 d\u00f9ng h\u1ebft h\u1ea1n m\u1ee9c AI c\u1ee7a th\u00e1ng n\u00e0y (200/200 credit, 80/100 tin nh\u1eafn, " +
                        "1.000/10.000 token). Chatbot t\u1ea1m d\u1eebng t\u1ef1 tr\u1ea3 l\u1eddi: kh\u00e1ch nh\u1eadn l\u1eddi x\u00e1c nh\u1eadn l\u1ecbch s\u1ef1 v\u00e0 " +
                        "c\u00e2u h\u1ecfi \u0111\u01b0\u1ee3c chuy\u1ec3n cho nh\u00e2n vi\u00ean. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i " +
                        "(/billing) \u0111\u1ec3 chatbot ho\u1ea1t \u0111\u1ed9ng l\u1ea1i.",
                ],
            ],
        ])
        expect(logger.error.mock.calls).toEqual([
            [AiUsageEventsLogEvent.NoticeFailed, failure, { workspaceId: "ws-1" }],
        ])
    })
})

describe("AiUsageEventsService > a call made for a run", () => {
    it("books the call to the run named, else to the run in scope, else to none", async () => {
        const em = mockEntityManager({ insert: [AiUsageEventEntity, {}], query: [SELECT_QUOTA_STATUS, []] })
        const { usage } = await build(em)

        await usage.record({ ...INPUT, runId: "run-9" })
        await withRunScope("run-5", () => usage.record(INPUT))
        await withRunScope("run-5", () => usage.record({ ...INPUT, runId: "run-9" }))
        await usage.record(INPUT)

        expect(em.insert.mock.calls.map((call) => call[1])).toEqual([
            expect.objectContaining({ runId: "run-9" }),
            expect.objectContaining({ runId: "run-5" }),
            expect.objectContaining({ runId: "run-9" }),
            expect.objectContaining({ runId: null }),
        ])
    })
})

describe("AiUsageEventsService > creditsByRun", () => {
    it("groups the whole credits of the runs given, the guide left out", async () => {
        const em = mockEntityManager()
        const sums = fakeQueryBuilder({
            getRawMany: [
                { run_id: "run-1", credits: 12 },
                { run_id: "run-2", credits: 3 },
            ],
        })
        em.createQueryBuilder.mockReturnValue(sums.builder)
        const { usage } = await build(em)

        const credits = await usage.creditsByRun("ws-1", ["run-1", "run-2", "run-3"])

        expect([...credits]).toEqual([
            ["run-1", 12],
            ["run-2", 3],
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AiUsageEventEntity, "u")
        expect(sums.callsOf("andWhere")).toEqual([
            ["u.run_id IN (:...runIds)", { runIds: ["run-1", "run-2", "run-3"] }],
        ])
        expect(sums.callsOf("groupBy")).toEqual([["u.run_id"]])
    })

    it("reads nothing for no runs", async () => {
        const em = mockEntityManager()
        const { usage } = await build(em)

        await expect(usage.creditsByRun("ws-1", [])).resolves.toEqual(new Map())
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("AiUsageEventsService > callKindsByRun", () => {
    it("groups one run's calls by call kind (the guide left out), in the order the kinds were first called", async () => {
        const em = mockEntityManager()
        const rollup = fakeQueryBuilder({
            getRawMany: [
                {
                    step_key: "match",
                    purpose: "accounting.match-payment:agent",
                    calls: 1,
                    tries: 2,
                    failed_tries: 1,
                    cache_write_tokens: 0,
                    failed_prompt_tokens: 8000,
                    failed_cost_usd: 0.016,
                    failures: ["timeout", null],
                    work_kinds: ["node"],
                    max_try: 1,
                    prompt_tokens: 8162,
                    cached_tokens: 8064,
                    completion_tokens: 2636,
                    reasoning_tokens: 2542,
                    duration_ms: 7414,
                    slowest_ms: 7414,
                    cost_usd: 0.0012,
                    upstreams: ["Parasail"],
                    finish_reasons: ["stop"],
                    models: ["claude-sonnet-5-5"],
                    declared_models: ["auto"],
                    model_providers: ["anthropic"],
                    model_reasons: ["auto-heavy"],
                },
            ],
        })
        em.createQueryBuilder.mockReturnValue(rollup.builder)
        const { usage } = await build(em)

        await expect(usage.callKindsByRun("ws-1", "run-1")).resolves.toEqual([
            {
                stepKey: "match",
                purpose: "accounting.match-payment:agent",
                calls: 1,
                tries: 2,
                failedTries: 1,
                cacheWriteTokens: 0,
                failedPromptTokens: 8000,
                failedCostUsd: 0.016,
                failures: ["timeout"],
                workKinds: ["node"],
                credits: 1.061947,
                failedCredits: 14.159292,
                maxTry: 1,
                promptTokens: 8162,
                cachedTokens: 8064,
                completionTokens: 2636,
                reasoningTokens: 2542,
                durationMs: 7414,
                slowestMs: 7414,
                costUsd: 0.0012,
                upstreams: ["Parasail"],
                finishReasons: ["stop"],
                models: ["claude-sonnet-5-5"],
                declaredModels: ["auto"],
                modelProviders: ["anthropic"],
                modelReasons: ["auto-heavy"],
            },
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AiUsageEventEntity, "u")
        expect(rollup.callsOf("where")).toEqual([
            [
                "u.workspace_id = :workspaceId AND u.run_id = :runId AND u.kind <> 'guide'",
                { workspaceId: "ws-1", runId: "run-1" },
            ],
        ])
        expect(rollup.callsOf("select")).toEqual([["u.step_key", "step_key"]])
        expect(rollup.callsOf("addSelect")).toContainEqual(["COALESCE(u.purpose, u.kind)", "purpose"])
        expect(rollup.callsOf("addSelect")).toContainEqual([
            "(COUNT(*) FILTER (WHERE u.failure IS NULL))::int",
            "calls",
        ])
        expect(rollup.callsOf("groupBy")).toEqual([["1"]])
        expect(rollup.callsOf("addGroupBy")).toEqual([["2"]])
        expect(rollup.callsOf("orderBy")).toEqual([["MIN(u.created_at)", "ASC"]])
        expect(rollup.callsOf("limit")).toEqual([[100]])
    })
})
