import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { FakeTransaction } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { AGENTS_QUEUE, AGENTS_QUEUE_PRODUCER, AgentsQueue } from "@modules/queues/agents"
import type { GenerateParams } from "./ai-generations.contracts"
import { AI_GENERATIONS_OPTIONS, AI_GENERATIONS_USAGE } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { AiGenerationsOptions } from "./ai-generations.options"
import type { UsageGate } from "./ai-generations.port"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { EngineStatusService } from "@modules/domain/agents"
import { AiGenerationsErrorCode } from "./errors/ai-generations.error"
import { GenerationsService } from "./generations.service"
import { CANCEL_GENERATION, FIND_GENERATION_PROGRESS, INSERT_GENERATION } from "./persistence/ai-generations.sql"
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
    const outbox = recordingQueueOutbox()
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
            { provide: AGENTS_QUEUE_PRODUCER, useClass: AgentsQueue },
            { provide: AI_GENERATIONS_OPTIONS, useValue: OPTIONS },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AI_GENERATIONS_USAGE, useValue: usage },
            { provide: EngineStatusService, useValue: engine },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: PauseClient, useValue: pause },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(GenerationsService), tx, outbox, usage, pause, logger, catalog, members }
}

describe("GenerationsService", () => {
    describe("generateFor", () => {
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
    })

    describe("generate", () => {
        it("writes the row and its job in one transaction and answers the text once the job filled it", async () => {
            const { service, tx, outbox, pause } = await build({ progress: [QUEUED, DONE] })

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
                '{"messages":[{"role":"user","content":"hi"}],"response_format":"json","timeout_ms":60000}',
            ])
            expect(outbox.jobsOf(AGENTS_QUEUE)).toEqual([
                { queue: AGENTS_QUEUE, payload: { generationId: "g1", workspaceId: "w1" } },
            ])
            expect(outbox.allInTransaction).toBe(true)
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
            const { service, tx, outbox } = await build()
            tx.em.query.mockReset()
            tx.em.query.mockResolvedValueOnce([])

            await expect(service.generate(paramsOf())).resolves.toMatchObject({ ok: false, reason: "error" })
            expect(outbox.jobs).toEqual([])
        })
    })

    describe("text", () => {
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
})
