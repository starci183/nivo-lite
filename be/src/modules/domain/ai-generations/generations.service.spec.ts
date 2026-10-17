import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { FakeTransaction } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AGENTS_QUEUE_PRODUCER } from "@modules/queues/agents"
import type { AgentsQueue } from "@modules/queues/agents"
import type { GenerateParams } from "./ai-generations.contracts"
import { AI_GENERATIONS_OPTIONS, AI_GENERATIONS_USAGE } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { AiGenerationsOptions } from "./ai-generations.options"
import type { UsageGate } from "./ai-generations.port"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { EngineStatusService } from "@modules/domain/agents"
import { AiGenerationsErrorCode } from "./errors/ai-generations.error"
import { GenerationsService } from "./generations.service"
import {
    CANCEL_GENERATION,
    FIND_GENERATION_PROGRESS,
    FIND_GENERATION_STATE,
    INSERT_GENERATION,
    LOCK_GENERATION_STATE,
    RECORD_GENERATION_FAILURE,
    RECORD_GENERATION_RESULT,
    SET_GENERATION_CONTEXT,
} from "./persistence/ai-generations.sql"
import { PauseClient } from "@modules/domain/agents"

const OPTIONS: Omit<AiGenerationsOptions, "usage"> = { pollMs: 400 }

const paramsOf = builder<GenerateParams>({
    workspaceId: "w1",
    purpose: "relay",
    messages: [{ role: "user", content: "hi" }],
    responseFormat: "text",
    kind: "relay",
    module: "office",
})

const QUEUED = { status: "queued", output: null, usage: null, timings: {} }
const DONE = { status: "done", output: { text: "hello" }, usage: null, timings: { total_ms: 12 } }

interface Setup {
    availability?: "ready" | "offline" | "not_configured"
    blocked?: string
    progress?: ReadonlyArray<unknown>
}

const build = async (setup: Setup = {}) => {
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const tx: FakeTransaction = fakeTransaction(
        mockEntityManager({
            query: [
                [INSERT_GENERATION, [{ id: "g1" }]],
                ...(setup.progress ?? [DONE]).map((row) => [FIND_GENERATION_PROGRESS, [row]] as const),
                [CANCEL_GENERATION, []],
            ],
        }),
    )
    const queue = mock<AgentsQueue>({ enqueueGenerate: jest.fn(() => Promise.resolve()) })
    const usage = mock<UsageGate>({
        blockedBy: jest.fn(() => Promise.resolve(setup.blocked === undefined ? null : { message: setup.blocked })),
    })
    const engine = mock<EngineStatusService>({ availability: jest.fn(() => setup.availability ?? "ready") })
    const pause = mock<PauseClient>({
        wait: jest.fn((ms: number) => {
            clock.advance(ms)
            return Promise.resolve()
        }),
    })
    const members = mock<WorkspaceMembersService>()
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GenerationsService,
            { provide: AGENTS_QUEUE_PRODUCER, useValue: queue },
            { provide: AI_GENERATIONS_OPTIONS, useValue: OPTIONS },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AI_GENERATIONS_USAGE, useValue: usage },
            { provide: EngineStatusService, useValue: engine },
            { provide: PauseClient, useValue: pause },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(GenerationsService), tx, queue, usage, pause, logger, catalog, members, engine }
}

describe("GenerationsService generateFor", () => {
    it("proves the caller belongs to the workspace, then writes the text", async () => {
        const { service, members } = await build()

        const outcome = await service.generateFor("u1", paramsOf())

        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(outcome.ok).toBe(true)
    })

    it("writes nothing for someone who is not a member", async () => {
        const { service, members, tx } = await build()
        const refusal = new Error("not a member")
        members.require.mockRejectedValue(refusal)

        await expect(service.generateFor("u1", paramsOf())).rejects.toBe(refusal)
        expect(tx.em.query).not.toHaveBeenCalled()
    })

    it("refuses a NIVO-paid kind such as guide and writes nothing", async () => {
        const { service, tx } = await build()

        await expect(service.generateFor("u1", paramsOf({ kind: "guide", module: "other" }))).rejects.toMatchObject({
            code: AiGenerationsErrorCode.KindNotAllowed,
        })
        expect(tx.em.query).not.toHaveBeenCalled()
    })
})

describe("GenerationsService requestFor", () => {
    it("refuses a kind the named module does not own and queues nothing", async () => {
        const { service, queue } = await build()

        await expect(service.requestFor("u1", paramsOf({ kind: "owner_chat", module: "sales" }))).rejects.toMatchObject(
            {
                code: AiGenerationsErrorCode.KindNotAllowed,
            },
        )
        expect(queue.enqueueGenerate).not.toHaveBeenCalled()
    })

    it("authorizes the member and returns the queued id without polling", async () => {
        const { service, members, tx, queue, pause } = await build()
        await expect(service.requestFor("u1", paramsOf())).resolves.toEqual({ ok: true, generationId: "g1" })
        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(queue.enqueueGenerate).toHaveBeenCalledWith({ generationId: "g1", workspaceId: "w1" }, expect.anything())
        expect(tx.commits).toBe(1)
        expect(pause.wait).not.toHaveBeenCalled()
    })

    it("returns the localized engine refusal without enqueueing", async () => {
        const { service, members, tx, queue, catalog } = await build({ availability: "offline" })
        await expect(service.requestFor("u1", paramsOf({ locale: "en" }))).resolves.toEqual({
            ok: false,
            reason: "engine_offline",
            message: "[generation.busy]",
        })
        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(catalog.get).toHaveBeenCalledWith("generation.busy", {}, "en")
        expect(tx.em.query).not.toHaveBeenCalled()
        expect(queue.enqueueGenerate).not.toHaveBeenCalled()
    })
})

describe("GenerationsService request", () => {
    it.each([false, true])("enqueues context using a supplied transaction: %s", async (supplied) => {
        const { service, tx, queue, usage } = await build()
        const context = { leadId: "lead1" }
        const params = paramsOf({ purpose: "x".repeat(65), timeoutMs: 1000, locale: "en" })
        await expect(service.request(params, context, supplied ? tx.em : undefined)).resolves.toEqual({
            id: "g1",
            status: "queued",
        })
        expect(usage.blockedBy).toHaveBeenCalledWith("w1", "relay", "en")
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_GENERATION, [
            "w1",
            "x".repeat(60),
            "office",
            "relay",
            '{"messages":[{"role":"user","content":"hi"}],"response_format":"text' +
                '","timeout_ms":5000,"context":{"leadId":"lead1"}}',
        ])
        expect(queue.enqueueGenerate).toHaveBeenCalledWith(
            { generationId: "g1", workspaceId: "w1" },
            supplied ? tx.em : expect.anything(),
        )
        expect(tx.commits).toBe(supplied ? 0 : 1)
    })

    it.each([
        [{ blocked: "Over the plan" }, AiGenerationsErrorCode.QuotaBlocked],
        [{ availability: "offline" }, AiGenerationsErrorCode.EngineUnavailable],
    ] as const)("refuses unavailable work before inserting: %j", async (setup, code) => {
        const { service, tx, queue, usage } = await build(setup)
        await expect(service.request(paramsOf())).rejects.toMatchObject({ code })
        expect(usage.blockedBy).toHaveBeenCalledWith("w1", "relay", "vi")
        expect(tx.em.query).not.toHaveBeenCalled()
        expect(queue.enqueueGenerate).not.toHaveBeenCalled()
        expect(tx.commits).toBe(0)
    })

    it("fails when no row was created and rolls back without a job", async () => {
        const { service, tx, queue } = await build()
        tx.em.query.mockResolvedValueOnce([])
        await expect(service.request(paramsOf())).rejects.toMatchObject({ code: AiGenerationsErrorCode.NotCreated })
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_GENERATION, [
            "w1",
            "relay",
            "office",
            "relay",
            '{"messages":[{"role":"user","content":"hi"}],"response_format":"text' +
                '","timeout_ms":45000,"context":{}}',
        ])
        expect(queue.enqueueGenerate).not.toHaveBeenCalled()
        expect(tx.commits).toBe(0)
    })
})

describe("GenerationsService state and completion", () => {
    it("locks a workspace row in the supplied transaction and maps its durable state", async () => {
        const { service, tx } = await build()
        const input = { messages: [{ role: "user", content: "hi" }], context: { leadId: "lead1" } }
        const output = { text: "hello", result: { leadId: "lead1" } }
        tx.em.query.mockResolvedValueOnce([
            {
                id: "g1",
                workspace_id: "w1",
                purpose: "relay",
                status: "done",
                input,
                output,
                error: null,
                usage: null,
                timings: { total_ms: 12, ignored: "bad" },
                created_at: new Date("2026-10-12T10:00:00.000Z"),
                finished_at: "2026-10-12T10:00:01.000Z",
            },
        ])
        await expect(service.state("w1", "g1", tx.em, true)).resolves.toEqual({
            id: "g1",
            workspaceId: "w1",
            purpose: "relay",
            status: "done",
            text: "hello",
            errorCode: null,
            input,
            output,
            timings: { total_ms: 12 },
            createdAt: "2026-10-12T10:00:00.000Z",
            finishedAt: "2026-10-12T10:00:01.000Z",
            messages: [{ role: "user", content: "hi" }],
        })
        expect(tx.em.query).toHaveBeenCalledWith(LOCK_GENERATION_STATE, ["g1", "w1"])
    })

    it("reads without a lock and normalizes malformed persisted records", async () => {
        const { service, tx } = await build()
        tx.em.query.mockResolvedValueOnce([
            {
                id: "g2",
                workspace_id: "w1",
                purpose: "relay",
                status: "error",
                input: [],
                output: null,
                error: "VALIDATION_FAILED",
                usage: null,
                timings: {},
                created_at: "2026-10-12T10:00:00.000Z",
                finished_at: null,
            },
        ])
        await expect(service.state("w1", "g2")).resolves.toEqual({
            id: "g2",
            workspaceId: "w1",
            purpose: "relay",
            status: "error",
            text: null,
            errorCode: "VALIDATION_FAILED",
            input: {},
            output: {},
            timings: {},
            createdAt: "2026-10-12T10:00:00.000Z",
            finishedAt: null,
            messages: [],
        })
        expect(tx.em.query).toHaveBeenCalledWith(FIND_GENERATION_STATE, ["g2", "w1"])
    })
})

describe("GenerationsService state and completion", () => {
    it("returns no state when the workspace has no matching generation", async () => {
        const { service, tx } = await build()
        tx.em.query.mockResolvedValueOnce([])
        await expect(service.state("w2", "g1")).resolves.toBeNull()
        expect(tx.em.query).toHaveBeenCalledWith(FIND_GENERATION_STATE, ["g1", "w2"])
    })

    it("records context, result and a stable failure in their owning transaction", async () => {
        const { service, tx } = await build()
        tx.em.query.mockResolvedValue([])
        await service.setContext("w1", "g1", { leadId: "lead1" }, tx.em)
        await service.recordResult("w1", "g1", { applied: true }, tx.em)
        await service.recordFailure("w1", "g1", "VALIDATION_FAILED", tx.em)
        expect(tx.em.query).toHaveBeenNthCalledWith(1, SET_GENERATION_CONTEXT, ["g1", "w1", '{"leadId":"lead1"}'])
        expect(tx.em.query).toHaveBeenNthCalledWith(2, RECORD_GENERATION_RESULT, ["g1", "w1", '{"applied":true}'])
        expect(tx.em.query).toHaveBeenNthCalledWith(3, RECORD_GENERATION_FAILURE, ["g1", "w1", "VALIDATION_FAILED"])
    })
})

describe("GenerationsService statusFor and progress", () => {
    it.each([
        ["done", "done"],
        ["running", "running"],
        ["queued", "queued"],
        ["error", "failed"],
        ["cancelled", "failed"],
    ] as const)("maps stored status %s to %s after membership authorization", async (stored, expected) => {
        const { service, tx, members } = await build()
        const usage = { prompt_tokens: 2, completion_tokens: 3, cached_tokens: 1, cost: 0.1, model: "test" }
        tx.em.query.mockResolvedValueOnce([
            { status: stored, output: { text: "hello" }, usage, timings: { total_ms: 12 } },
        ])
        await expect(service.statusFor("u1", "w1", "g1")).resolves.toEqual({
            generationId: "g1",
            status: expected,
            output: "hello",
            usage,
            timings: { total_ms: 12 },
        })
        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(tx.em.query).toHaveBeenCalledWith(FIND_GENERATION_PROGRESS, ["g1", "w1"])
    })

    it("scopes missing progress to the workspace and reports not-found to members", async () => {
        const { service, tx, members } = await build()
        tx.em.query.mockResolvedValue([])
        await expect(service.progress("w2", "g1")).resolves.toBeNull()
        expect(members.require).not.toHaveBeenCalled()
        await expect(service.statusFor("u1", "w2", "g1")).rejects.toMatchObject({
            code: AiGenerationsErrorCode.GenerationNotFound,
        })
        expect(tx.em.query).toHaveBeenCalledWith(FIND_GENERATION_PROGRESS, ["g1", "w2"])
        expect(members.require).toHaveBeenCalledWith("u1", "w2")
    })
})

describe("GenerationsService prepare", () => {
    it.each([
        [{ blocked: "Over the plan" }, false],
        [{ availability: "offline" }, true],
    ] as const)("returns fallback without inserting when unavailable: %j", async (setup, checkedEngine) => {
        const { service, tx, queue, usage, engine } = await build(setup)
        await expect(service.prepare(paramsOf(), tx.em)).resolves.toBeNull()
        expect(usage.blockedBy).toHaveBeenCalledWith("w1", "relay", "vi")
        expect(engine.availability).toHaveBeenCalledTimes(checkedEngine ? 1 : 0)
        expect(tx.em.query).not.toHaveBeenCalled()
        expect(queue.enqueueGenerate).not.toHaveBeenCalled()
    })

    it("inserts in the fenced job's transaction without starting another job", async () => {
        const { service, tx, queue, usage } = await build()
        await expect(service.prepare(paramsOf({ locale: "en", timeoutMs: 200_000 }), tx.em)).resolves.toBe("g1")
        expect(usage.blockedBy).toHaveBeenCalledWith("w1", "relay", "en")
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_GENERATION, [
            "w1",
            "relay",
            "office",
            "relay",
            '{"messages":[{"role":"user","content":"hi"}],"response_format":"text' + '","timeout_ms":120000}',
        ])
        expect(tx.commits).toBe(0)
        expect(queue.enqueueGenerate).not.toHaveBeenCalled()
    })
})

describe("GenerationsService generate", () => {
    it("writes the row and its job in one transaction and answers the text once the job filled it", async () => {
        const { service, tx, queue, pause } = await build({ progress: [QUEUED, DONE] })

        const outcome = await service.generate(paramsOf({ responseFormat: "json", timeoutMs: 60_000 }))

        expect(outcome).toEqual({
            ok: true,
            output: "hello",
            generationId: "g1",
            timings: { total_ms: 12 },
            usage: null,
        })
        expect(tx.em.query).toHaveBeenNthCalledWith(1, INSERT_GENERATION, [
            "w1",
            "relay",
            "office",
            "relay",
            '{"messages":[{"role":"user","content":"hi"}],"response_format":"json' + '","timeout_ms":60000}',
        ])
        expect(queue.enqueueGenerate).toHaveBeenCalledWith({ generationId: "g1", workspaceId: "w1" }, expect.anything())
        expect(tx.commits).toBe(1)
        expect(pause.wait).toHaveBeenCalledTimes(2)
        expect(pause.wait).toHaveBeenCalledWith(400)
        expect(tx.em.query).toHaveBeenNthCalledWith(2, FIND_GENERATION_PROGRESS, ["g1", "w1"])
    })

    it("refuses a workspace over its allowance with the allowance's own sentence", async () => {
        const { service, tx, usage } = await build({ blocked: "Over the plan" })

        await expect(service.generate(paramsOf({ locale: "en" }))).resolves.toEqual({
            ok: false,
            reason: "quota",
            message: "Over the plan",
        })
        expect(usage.blockedBy).toHaveBeenCalledWith("w1", "relay", "en")
        expect(tx.em.query).not.toHaveBeenCalled()
    })

    it("says the engine is not configured or offline with the busy sentence", async () => {
        const missing = await build({ availability: "not_configured" })
        const offline = await build({ availability: "offline" })

        await expect(missing.service.generate(paramsOf())).resolves.toEqual({
            ok: false,
            reason: "not_configured",
            message: "[generation.busy]",
        })
        await expect(offline.service.generate(paramsOf())).resolves.toMatchObject({ reason: "engine_offline" })
        expect(missing.catalog.get).toHaveBeenCalledWith("generation.busy", {}, "vi")
        expect(missing.tx.em.query).not.toHaveBeenCalled()
    })

    it("fails with error when the row ends in error or is cancelled", async () => {
        const { service, logger } = await build({
            progress: [{ status: "error", output: null, usage: null, timings: {} }],
        })

        await expect(service.generate(paramsOf())).resolves.toMatchObject({ ok: false, reason: "error" })
        expect(logger.warn).toHaveBeenCalledWith(AiGenerationsLogEvent.GenerationErrored, {
            purpose: "relay",
            generationId: "g1",
        })
    })
})

describe("GenerationsService generate", () => {
    it("cancels the row and fails with timeout once the deadline passed", async () => {
        const { service, tx } = await build({ progress: Array.from({ length: 13 }, () => QUEUED) })

        const outcome = await service.generate(paramsOf({ timeoutMs: 5000 }))

        expect(outcome).toMatchObject({ ok: false, reason: "timeout" })
        expect(tx.em.query).toHaveBeenLastCalledWith(CANCEL_GENERATION, ["g1", "w1", "2026-10-12T10:00:05.200Z"])
    })

    it("treats a vanished row as too slow", async () => {
        const { service, tx } = await build({ progress: [] })
        tx.em.query.mockReset()
        tx.em.query
            .mockResolvedValueOnce([{ id: "g1" }])
            .mockResolvedValueOnce([])
            .mockResolvedValue([])

        await expect(service.generate(paramsOf())).resolves.toMatchObject({ ok: false, reason: "timeout" })
    })

    it("fails with error and logs when the row cannot be written", async () => {
        const { service, tx, logger } = await build()
        const failure = new Error("database down")
        tx.em.query.mockReset()
        tx.em.query.mockRejectedValue(failure)

        await expect(service.generate(paramsOf())).resolves.toMatchObject({ ok: false, reason: "error" })
        expect(logger.error).toHaveBeenCalledWith(AiGenerationsLogEvent.GenerationFailed, failure, {
            purpose: "relay",
        })
    })

    it("fails with error when the insert answers no row", async () => {
        const { service, tx, queue } = await build()
        tx.em.query.mockReset()
        tx.em.query.mockResolvedValueOnce([])

        await expect(service.generate(paramsOf())).resolves.toMatchObject({ ok: false, reason: "error" })
        expect(queue.enqueueGenerate).not.toHaveBeenCalled()
    })
})

describe("GenerationsService text", () => {
    it("answers just the text", async () => {
        const { service } = await build()

        await expect(service.text(paramsOf())).resolves.toBe("hello")
    })

    it("throws the generation error carrying the sentence to show", async () => {
        const { service } = await build({ blocked: "Over the plan" })

        await expect(service.text(paramsOf())).rejects.toMatchObject({
            code: AiGenerationsErrorCode.GenerationFailed,
            params: { reason: "quota", message: "Over the plan" },
        })
    })
})
