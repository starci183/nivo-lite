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

/** The statements `callDbFunction` sends for the usage functions. */
const RECORD_USAGE_EVENT = 'SELECT * FROM "public"."record_ai_usage_work"($1, $2, $3, $4, $5, $6, $7, $8, $9)'

/** The work facts of a call booked outside any scope. */
const NO_WORK = JSON.stringify({
    run_id: null,
    work_kind: null,
    work_ref: null,
    step_key: null,
    agent_id: null,
    failure: null,
    try_number: null,
    duration_ms: null,
    purpose: null,
})
const SELECT_QUOTA_STATUS = 'SELECT * FROM "public"."ai_quota_status"($1)'
const POST_USAGE_NOTICE = 'SELECT * FROM "public"."post_ai_usage_notice"($1, $2, $3, $4)'
import { withRunScope, withWorkScope } from "@modules/platform/logging"
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
                NO_WORK,
            ])
            expect(em.query).toHaveBeenCalledTimes(2)
        })

        it("books the call to the run and the work in scope: the document a job reads, the agent and step of a node", async () => {
            const em = mockEntityManager({ query: [INSERTED, [SELECT_QUOTA_STATUS, [rowOf()]]] })
            const { meter } = await build(em)
            const agentId = "0b6f6c2e-1111-4222-8333-444455556666"

            await withRunScope("9e0c8d1a-1111-4222-8333-444455556666", () =>
                withWorkScope({ kind: "document_read", ref: "source:src-1", agentId }, () => meter.record(recordOf())),
            )

            const facts: unknown = JSON.parse(String(em.query.mock.calls[0]?.[1]?.[8]))
            expect(facts).toMatchObject({
                run_id: "9e0c8d1a-1111-4222-8333-444455556666",
                work_kind: "document_read",
                work_ref: "source:src-1",
                agent_id: agentId,
                failure: null,
            })
        })

        it("books a FAILED try estimated from the prompt it sent, no output, priced, with its failure and try (never billed)", async () => {
            const em = mockEntityManager({ query: [INSERTED, [SELECT_QUOTA_STATUS, [rowOf()]]] })
            const { meter } = await build(em)

            await meter.record(
                recordOf({
                    kind: "brain",
                    model: "claude-sonnet-5-5",
                    usage: null,
                    promptChars: 3000,
                    completionChars: 0,
                    failure: "timeout",
                    tryNumber: 2,
                }),
            )

            const args = em.query.mock.calls[0]?.[1] ?? []
            // 3,000 characters = 1,000 tokens estimated; Sonnet 5.5 at $2 per million input tokens.
            expect(args.slice(4, 8)).toEqual([1000, 0, 0.002, true])
            expect(JSON.parse(String(args[8]))).toMatchObject({ failure: "timeout", try_number: 2 })
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
                query: [INSERTED, [SELECT_QUOTA_STATUS, [row]], [POST_USAGE_NOTICE, [{ post_ai_usage_notice: true }]]],
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
                    [POST_USAGE_NOTICE, [{ post_ai_usage_notice: true }]],
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
                    [POST_USAGE_NOTICE, [{ post_ai_usage_notice: true }]],
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
