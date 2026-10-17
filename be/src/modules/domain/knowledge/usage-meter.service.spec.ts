import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { UsageRecord } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import type { QuotaStatusRow } from "./persistence/usage.rows"
import { POST_USAGE_NOTICE, RECORD_USAGE_EVENT, SELECT_QUOTA_STATUS } from "./persistence/usage.sql"
import { UsageMeterService } from "./usage-meter.service"

const recordOf = builder<UsageRecord>({
    workspaceId: "ws-1",
    kind: "embedding",
    module: "knowledge",
    model: "qwen/x",
    usage: { promptTokens: 30, completionTokens: 0, totalTokens: 30, costUsd: 0.001 },
})

const rowOf = builder<QuotaStatusRow>({
    period_start: "2026-10-01",
    messages_used: 0,
    tokens_used: 0,
    cost_usd: 0,
    messages_limit: null,
    tokens_limit: null,
    credits_used: 0,
    credits_limit: null,
    topup_balance: null,
})

const INSERTED: readonly [string, unknown] = [RECORD_USAGE_EVENT, []]

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("notice text")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            UsageMeterService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { meter: moduleRef.get(UsageMeterService), catalog, logger }
}

describe("UsageMeterService", () => {
    describe("record", () => {
        it("writes the call to the ledger and stays quiet while the allowance is fine", async () => {
            const em = mockEntityManager({ query: [INSERTED, [SELECT_QUOTA_STATUS, [rowOf()]]] })
            const { meter } = await build(em)

            await meter.record(recordOf())

            expect(em.query).toHaveBeenCalledWith(RECORD_USAGE_EVENT, [
                "ws-1",
                "embedding",
                "knowledge",
                "qwen/x",
                30,
                0,
                0.001,
                false,
            ])
            expect(em.query).toHaveBeenCalledTimes(2)
        })

        it("does nothing more when the allowance cannot be read", async () => {
            const em = mockEntityManager({ query: [INSERTED, [SELECT_QUOTA_STATUS, []]] })
            const { meter } = await build(em)

            await meter.record(recordOf())

            expect(em.query).toHaveBeenCalledTimes(2)
        })

        it("tells the owner once when a level is reached, with every allowance named", async () => {
            const row = rowOf({
                messages_used: 8,
                messages_limit: 10,
                tokens_used: 8,
                tokens_limit: 10,
                credits_used: 80,
                credits_limit: 100,
                topup_balance: 5,
            })
            const em = mockEntityManager({
                query: [INSERTED, [SELECT_QUOTA_STATUS, [row]], [POST_USAGE_NOTICE, [{ posted: true }]]],
            })
            const { meter, catalog } = await build(em)

            await meter.record(recordOf({ usage: null }))

            expect(catalog.get).toHaveBeenCalledWith(
                "usage.notice.warn",
                { percent: 80, use: "80/100 credit, 5 credit +, 8/10 messages, 8/10 tokens" },
                "vi",
            )
            expect(em.query).toHaveBeenCalledWith(POST_USAGE_NOTICE, ["ws-1", "2026-10-01", "warn", "notice text"])
        })
    })
})

describe("UsageMeterService", () => {
    describe("record", () => {
        it("names only the allowances that are set", async () => {
            const em = mockEntityManager({
                query: [
                    INSERTED,
                    [SELECT_QUOTA_STATUS, [rowOf({ tokens_used: 9, tokens_limit: 10 })]],
                    [POST_USAGE_NOTICE, [{ posted: true }]],
                ],
            })
            const { meter, catalog } = await build(em)

            await meter.record(recordOf())

            expect(catalog.get).toHaveBeenCalledWith("usage.notice.warn", { percent: 90, use: "9/10 tokens" }, "vi")
        })

        it("logs and swallows a failure to record, to read the allowance or to post the notice", async () => {
            const writeFails = mockEntityManager({ query: [RECORD_USAGE_EVENT, []] })
            writeFails.query.mockRejectedValueOnce(new Error("write"))
            const first = await build(writeFails)
            await expect(first.meter.record(recordOf())).resolves.toBeUndefined()
            expect(first.logger.error).toHaveBeenCalledWith(KnowledgeLogEvent.UsageRecordFailed, expect.any(Error), {
                workspaceId: "ws-1",
            })

            const readFails = mockEntityManager({ query: INSERTED })
            readFails.query.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("read"))
            const second = await build(readFails)
            await expect(second.meter.record(recordOf())).resolves.toBeUndefined()
            expect(second.logger.error).toHaveBeenCalledWith(KnowledgeLogEvent.QuotaReadFailed, expect.any(Error), {
                workspaceId: "ws-1",
            })

            const noticeFails = mockEntityManager({
                query: [INSERTED, [SELECT_QUOTA_STATUS, [rowOf({ tokens_used: 9, tokens_limit: 10 })]]],
            })
            noticeFails.query
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([rowOf({ tokens_used: 9, tokens_limit: 10 })])
                .mockRejectedValueOnce(new Error("claim"))
            const third = await build(noticeFails)
            await expect(third.meter.record(recordOf())).resolves.toBeUndefined()
            expect(third.logger.error).toHaveBeenCalledWith(KnowledgeLogEvent.NoticeFailed, expect.any(Error), {
                workspaceId: "ws-1",
            })
        })
    })
})

describe("UsageMeterService", () => {
    describe("blockedBy", () => {
        const exceeded = rowOf({ tokens_used: 10, tokens_limit: 10 })

        it("blocks a call when the allowance is used up and tells the owner", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_QUOTA_STATUS, [exceeded]],
                    [POST_USAGE_NOTICE, [{ posted: true }]],
                ],
            })
            const { meter, catalog } = await build(em)

            await expect(meter.blockedBy("ws-1", "brain", false)).resolves.toBe(true)

            expect(catalog.get).toHaveBeenCalledWith("usage.notice.exceeded", expect.any(Object), "vi")
        })

        it("lets a call go ahead while the allowance holds", async () => {
            const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, [rowOf()]] })
            const { meter } = await build(em)

            await expect(meter.blockedBy("ws-1", "brain", false)).resolves.toBe(false)
        })

        it("fails open when the allowance cannot be read", async () => {
            const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, []] })
            const { meter } = await build(em)

            await expect(meter.blockedBy("ws-1", "brain", false)).resolves.toBe(false)
        })
    })
})
