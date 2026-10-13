import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { QuotaStatus, UsageInput, UsageKind } from "./ai-usage-events.contracts"
import { AiUsageEventsLogEvent } from "./ai-usage-events.log-events"
import { AiUsageEventsService } from "./ai-usage-events.service"
import type { QuotaRow } from "./persistence/ai-usage-events.rows"
import { INSERT_USAGE_EVENT, POST_USAGE_NOTICE, SELECT_QUOTA_STATUS } from "./persistence/ai-usage-events.sql"

const ROW: QuotaRow = {
    period_start: "2026-10-01",
    messages_used: 80,
    tokens_used: 1000,
    cost_usd: 0.4,
    messages_limit: 100,
    tokens_limit: 10000,
    fallback_reply: "  Vui l\u00f2ng ch\u1edd  ",
    credits_used: 100,
    credits_limit: 200,
    credits_carried: 20,
    topup_balance: 50,
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
    "M\u1ee9c d\u00f9ng AI th\u00e1ng n\u00e0y \u0111\u00e3 \u0111\u1ea1t 80% h\u1ea1n m\u1ee9c (100/200 credit, 50 credit n\u1ea1p th\u00eam c\u00f2n l\u1ea1i, 80/100 tin nh\u1eafn, 1.000/10.000 token). Khi h\u1ebft h\u1ea1n m\u1ee9c, chatbot s\u1ebd chuy\u1ec3n c\u00e2u h\u1ecfi c\u1ee7a kh\u00e1ch cho nh\u00e2n vi\u00ean thay v\u00ec t\u1ef1 tr\u1ea3 l\u1eddi. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing)."
const EXCEEDED_BODY =
    "Workspace \u0111\u00e3 d\u00f9ng h\u1ebft h\u1ea1n m\u1ee9c AI c\u1ee7a th\u00e1ng n\u00e0y (100/200 credit, 50 credit n\u1ea1p th\u00eam c\u00f2n l\u1ea1i, 100/100 tin nh\u1eafn, 1.000/10.000 token). Chatbot t\u1ea1m d\u1eebng t\u1ef1 tr\u1ea3 l\u1eddi: kh\u00e1ch nh\u1eadn l\u1eddi x\u00e1c nh\u1eadn l\u1ecbch s\u1ef1 v\u00e0 c\u00e2u h\u1ecfi \u0111\u01b0\u1ee3c chuy\u1ec3n cho nh\u00e2n vi\u00ean. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing) \u0111\u1ec3 chatbot ho\u1ea1t \u0111\u1ed9ng l\u1ea1i."

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
    describe("record", () => {
        it("books provider figures, truncates the model name and posts the monthly warning", async () => {
            const em = mockEntityManager({
                query: [
                    [INSERT_USAGE_EVENT, []],
                    [SELECT_QUOTA_STATUS, [ROW]],
                    [POST_USAGE_NOTICE, [{ posted: true }]],
                ],
            })
            const { usage, logger } = await build(em)

            await expect(usage.record({ ...INPUT, model: "x".repeat(121) })).resolves.toBeUndefined()

            expect(em.query.mock.calls).toEqual([
                [INSERT_USAGE_EVENT, ["ws-1", "chat_reply", "sales", "x".repeat(120), 100, 20, 0.01234568, false]],
                [SELECT_QUOTA_STATUS, ["ws-1"]],
                [POST_USAGE_NOTICE, ["ws-1", "2026-10-01", "warn", WARN_BODY]],
            ])
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("books estimated figures and sends no notice when no quota row is returned", async () => {
            const em = mockEntityManager({
                query: [
                    [INSERT_USAGE_EVENT, []],
                    [SELECT_QUOTA_STATUS, []],
                ],
            })
            const { usage, logger } = await build(em)

            await expect(usage.record({ ...INPUT, usage: null })).resolves.toBeUndefined()

            expect(em.query.mock.calls).toEqual([
                [INSERT_USAGE_EVENT, ["ws-1", "chat_reply", "sales", "deepseek-chat", 100, 20, 0.0000196, true]],
                [SELECT_QUOTA_STATUS, ["ws-1"]],
            ])
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("sends no notice for a quota below its warning level", async () => {
            const em = mockEntityManager({
                query: [
                    [INSERT_USAGE_EVENT, []],
                    [SELECT_QUOTA_STATUS, [{ ...ROW, messages_used: 10 }]],
                ],
            })
            const { usage, logger } = await build(em)

            await expect(usage.record(INPUT)).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledTimes(2)
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("logs a write failure without failing the model reply or reading its quota", async () => {
            const em = mockEntityManager()
            const failure = new Error("usage insert failed")
            em.query.mockRejectedValueOnce(failure)
            const { usage, logger } = await build(em)

            await expect(usage.record(INPUT)).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledTimes(1)
            expect(logger.error.mock.calls).toEqual([
                [AiUsageEventsLogEvent.RecordFailed, failure, { workspaceId: "ws-1" }],
            ])
        })

        it("keeps a successfully booked call when reading its quota fails", async () => {
            const em = mockEntityManager()
            const failure = new Error("quota read failed")
            em.query.mockResolvedValueOnce([]).mockRejectedValueOnce(failure)
            const { usage, logger } = await build(em)

            await expect(usage.record(INPUT)).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledTimes(2)
            expect(logger.error.mock.calls).toEqual([
                [AiUsageEventsLogEvent.StatusFailed, failure, { workspaceId: "ws-1" }],
            ])
        })
    })

    describe("quotaStatus", () => {
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

    describe("blockedBy", () => {
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
                        [SELECT_QUOTA_STATUS, [{ ...ROW, messages_used: 100 }]],
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
            const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, [{ ...ROW, messages_used: 100 }]] })
            const { usage } = await build(em)

            await expect(usage.blockedBy("ws-1", "embedding", true)).resolves.toBeNull()

            expect(em.query.mock.calls).toEqual([[SELECT_QUOTA_STATUS, ["ws-1"]]])
        })

        it("blocks bulk embeddings at the credit limit even when posting the owner notice fails", async () => {
            const em = mockEntityManager()
            const failure = new Error("notice unavailable")
            em.query
                .mockResolvedValueOnce([{ ...ROW, credits_used: 200, topup_balance: 0 }])
                .mockRejectedValueOnce(failure)
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
                        "Workspace \u0111\u00e3 d\u00f9ng h\u1ebft h\u1ea1n m\u1ee9c AI c\u1ee7a th\u00e1ng n\u00e0y (200/200 credit, 80/100 tin nh\u1eafn, 1.000/10.000 token). Chatbot t\u1ea1m d\u1eebng t\u1ef1 tr\u1ea3 l\u1eddi: kh\u00e1ch nh\u1eadn l\u1eddi x\u00e1c nh\u1eadn l\u1ecbch s\u1ef1 v\u00e0 c\u00e2u h\u1ecfi \u0111\u01b0\u1ee3c chuy\u1ec3n cho nh\u00e2n vi\u00ean. N\u1ea1p th\u00eam credit ho\u1eb7c n\u00e2ng c\u1ea5p g\u00f3i t\u1ea1i Credit & g\u00f3i (/billing) \u0111\u1ec3 chatbot ho\u1ea1t \u0111\u1ed9ng l\u1ea1i.",
                    ],
                ],
            ])
            expect(logger.error.mock.calls).toEqual([
                [AiUsageEventsLogEvent.NoticeFailed, failure, { workspaceId: "ws-1" }],
            ])
        })
    })
})
