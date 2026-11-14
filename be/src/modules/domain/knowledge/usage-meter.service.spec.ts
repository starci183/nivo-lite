import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { parseJsonText } from "@modules/platform/primitives"
import { USAGE_NOTICE_DOOR } from "@modules/domain/ai-usage-events"
import type { UsageNoticeDoor } from "@modules/domain/ai-usage-events"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { UsageRecord } from "./knowledge.contracts"
import { KnowledgeLogEvent } from "./knowledge.log-events"
import type { QuotaStatusRow } from "./persistence/usage.rows"

/** Reads the facts JSON a booked call sent; a text that does not parse comes back as the failed read, which no assertion matches. */
const parsedFacts = (text: string): unknown => {
    const read = parseJsonText(text)
    return read.ok ? read.value : read
}

/** The statements `callDbFunction` sends for the usage functions. */
const RECORD_USAGE_EVENT = 'SELECT * FROM "public"."record_ai_usage_work"($1, $2, $3, $4, $5, $6, $7, $8, $9)'

/** The work facts of a call booked outside any scope: a call that says nothing of its tries is its first. */
const NO_WORK = JSON.stringify({
    run_id: null,
    work_kind: null,
    work_ref: null,
    step_key: null,
    agent_id: null,
    failure: null,
    try_number: 1,
    duration_ms: null,
    purpose: null,
    upstream: null,
    finish_reason: null,
    cached_tokens: 0,
    cache_write_tokens: 0,
    reasoning_tokens: 0,
})
const SELECT_QUOTA_STATUS = 'SELECT * FROM "public"."ai_quota_status"($1)'
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
    const notices = mock<UsageNoticeDoor>()
    notices.postNotice.mockResolvedValue("posted")
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("notice text")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            UsageMeterService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: USAGE_NOTICE_DOOR, useValue: notices },
        ],
    }).compile()
    return { meter: moduleRef.get(UsageMeterService), catalog, logger, notices }
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

            const facts: unknown = parsedFacts(String(em.query.mock.calls[0]?.[1]?.[8]))
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
            expect(parsedFacts(String(args[8]))).toMatchObject({ failure: "timeout", try_number: 2 })
        })

    })
})

describe("UsageMeterService", () => {
    describe("record", () => {
        it("books a try CUT at its cap with the provider's real figures, not estimated, with its failure (never billed)", async () => {
            const em = mockEntityManager({ query: [INSERTED, [SELECT_QUOTA_STATUS, [rowOf()]]] })
            const { meter } = await build(em)

            await meter.record(
                recordOf({
                    kind: "brain",
                    model: "claude-haiku-5-5",
                    usage: { promptTokens: 900, completionTokens: 200, totalTokens: 1100, costUsd: 0.004 },
                    promptChars: 3000,
                    completionChars: 0,
                    failure: "length",
                }),
            )

            const args = em.query.mock.calls[0]?.[1] ?? []
            // The reported tokens and cost, not an estimate from the 3,000 characters; the failure keeps it out of the pool.
            expect(args.slice(4, 8)).toEqual([900, 200, 0.004, false])
            expect(parsedFacts(String(args[8]))).toMatchObject({ failure: "length" })
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
                query: [INSERTED, [SELECT_QUOTA_STATUS, [row]]],
            })
            const { meter, catalog, notices } = await build(em)

            await meter.record(recordOf({ usage: null }))

            expect(catalog.get).toHaveBeenCalledWith(
                "usage.notice.warn",
                { percent: 80, use: "80/100 credit, 5 credit +, 8/10 messages, 8/10 tokens" },
                "vi",
            )
            expect(notices.postNotice).toHaveBeenCalledTimes(1)
            expect(notices.postNotice).toHaveBeenCalledWith("ws-1", {
                key: "usage-notice:warn:2026-10-01",
                body: "notice text",
            })
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
            const third = await build(noticeFails)
            third.notices.postNotice.mockRejectedValue(new Error("claim"))
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
            const em = mockEntityManager({ query: [SELECT_QUOTA_STATUS, [exceeded]] })
            const { meter, catalog, notices } = await build(em)

            await expect(meter.blockedBy("ws-1", "brain", false)).resolves.toBe(true)

            expect(catalog.get).toHaveBeenCalledWith("usage.notice.exceeded", expect.any(Object), "vi")
            expect(notices.postNotice).toHaveBeenCalledWith("ws-1", {
                key: "usage-notice:exceeded:2026-10-01",
                body: "notice text",
            })
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

describe("UsageMeterService record: the facts of each try", () => {
    it("books the upstream, the finish reason, the time and the try of every try: an answer and a cut one alike", async () => {
        const em = mockEntityManager({
            query: [INSERTED, [SELECT_QUOTA_STATUS, [rowOf()]], INSERTED, [SELECT_QUOTA_STATUS, [rowOf()]]],
        })
        const { meter } = await build(em)
        const usage = { promptTokens: 900, completionTokens: 200, totalTokens: 1100, costUsd: 0.004 }

        await meter.record(
            recordOf({
                kind: "brain",
                model: "claude-haiku-5-5",
                usage,
                served: { upstream: "anthropic", finishReason: "end_turn", durationMs: 2140 },
            }),
        )
        await meter.record(
            recordOf({
                kind: "brain",
                model: "claude-haiku-5-5",
                usage,
                completionChars: 0,
                failure: "length",
                tryNumber: 2,
                served: { upstream: "anthropic", finishReason: "max_tokens", durationMs: 9000 },
            }),
        )

        const factsOf = (call: number): unknown => parsedFacts(String(em.query.mock.calls[call]?.[1]?.[8]))
        expect(factsOf(0)).toMatchObject({
            try_number: 1,
            duration_ms: 2140,
            upstream: "anthropic",
            finish_reason: "end_turn",
            failure: null,
        })
        expect(factsOf(2)).toMatchObject({
            try_number: 2,
            duration_ms: 9000,
            upstream: "anthropic",
            finish_reason: "max_tokens",
            failure: "length",
        })
    })

    it("books the cached, cache-written and reasoning tokens the provider reported (D-N-8), and none for an estimated try", async () => {
        const em = mockEntityManager({
            query: [INSERTED, [SELECT_QUOTA_STATUS, [rowOf()]], INSERTED, [SELECT_QUOTA_STATUS, [rowOf()]]],
        })
        const { meter } = await build(em)
        // The shape of a critique call on dev: 55 % of the prompt read from the cache.
        const usage = {
            promptTokens: 5734,
            completionTokens: 1059,
            totalTokens: 6793,
            costUsd: 0.0007,
            cachedTokens: 3154,
            cacheWriteTokens: 0,
            reasoningTokens: null,
        }

        await meter.record(recordOf({ kind: "brain", model: "claude-haiku-5-5", usage }))
        await meter.record(
            recordOf({ kind: "brain", model: "claude-haiku-5-5", usage: null, promptChars: 900, failure: "timeout" }),
        )

        const factsOf = (call: number): unknown => parsedFacts(String(em.query.mock.calls[call]?.[1]?.[8]))
        expect(factsOf(0)).toMatchObject({ cached_tokens: 3154, cache_write_tokens: 0, reasoning_tokens: 0 })
        expect(factsOf(2)).toMatchObject({ cached_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0 })
    })
})
