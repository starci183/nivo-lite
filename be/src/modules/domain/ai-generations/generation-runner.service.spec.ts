import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AI } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { generationRow } from "@tests/fixtures/builders/ai-generations.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { AI_GENERATIONS_USAGE } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { UsageGate } from "./ai-generations.port"
import { GenerationRunnerService } from "./generation-runner.service"
import { AiGenerationEntity } from "./persistence/entities"

const INPUT = { messages: [{ role: "user", content: "hi" }], response_format: "text", timeout_ms: 20_000 }

/** What the runner asks for when it looks the generation up. */
const FIND_OPTIONS = {
    where: { id: "g1", workspaceId: "w1" },
    select: { id: true, workspaceId: true, purpose: true, module: true, usageKind: true, status: true, input: true },
}

/** The write that starts a queued generation. */
const STARTED = [AiGenerationEntity, { id: "g1", workspaceId: "w1", status: "queued" }, { status: "running" }]

/** The write that cancels an open generation for a timeout at `iso`. */
const cancelledAt = (iso: string) => [
    AiGenerationEntity,
    { id: "g1", workspaceId: "w1", status: In(["queued", "running"]) },
    { status: "cancelled", error: "timeout", finishedAt: new Date(iso) },
]

/** The statuses a cancel, a failure or a finish may still change. */
const OPEN = In(["queued", "running"])

/**
 * A manager that finds `row` (nothing for null), accepts every update and, when `finish` is a list, answers it as the
 * rows of the finishing write; `finish` null stubs no finishing write at all, so the case proves the runner made none.
 */
const managerOf = (
    row: AiGenerationEntity | null = generationRow(),
    finish: ReadonlyArray<{ usage_kind: string; module: string }> | null = [{ usage_kind: "relay", module: "office" }],
) => {
    const em = mockEntityManager({
        findOne: [AiGenerationEntity, row],
        update: [AiGenerationEntity, { affected: 1 }],
    })
    const [finisher] = finish === null ? [] : queueQueryBuilders(em, [{ execute: { raw: finish } }])
    return { em, finisher }
}

const USAGE = { prompt_tokens: 10, completion_tokens: 5, cached_tokens: 0, cost: 0.1, model: "m" }

const PAYLOAD = { generationId: "g1", workspaceId: "w1" }

/** What the AI endpoint answers for the prompt, with the usage it reports. */
const ANSWER: AiChatAnswer = {
    text: "hello",
    parsed: null,
    model: "m",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.1 },
    retrieved: 0,
}

interface Setup {
    available?: boolean
    answer?: AiChatAnswer | null
    /** How long the model call takes, ms. */
    takesMs?: number
}

const build = async (entityManager: MockEntityManager, setup: Setup = {}) => {
    fakeTransaction(entityManager)
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const ai = mock<AiService>({
        available: jest.fn(() => setup.available ?? true),
        chat: jest.fn(() => {
            clock.advance(setup.takesMs ?? 1500)
            return Promise.resolve(setup.answer === undefined ? ANSWER : setup.answer)
        }),
    })
    const usage = mock<UsageGate>({ record: jest.fn(() => Promise.resolve()) })
    const logger = mock<Logger>()
    const bus = recordingEventBus()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GenerationRunnerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: AI_GENERATIONS_USAGE, useValue: usage },
            { provide: AI, useValue: ai },
            { provide: EVENT_BUS, useValue: bus },
        ],
    }).compile()
    return { runner: moduleRef.get(GenerationRunnerService), clock, ai, usage, logger, bus }
}

/** The event the runner publishes for generation g1 of workspace w1. */
const completedAs = (status: "done" | "error" | "cancelled"): unknown =>
    expect.objectContaining({
        eventName: "ai_generation_completed",
        eventId: "g1",
        payload: { dedupeKey: "g1", generationId: "g1", workspaceId: "w1", purpose: "relay", status },
    })

describe("GenerationRunnerService", () => {
    it("runs the generation of a job and publishes its end in the transaction that wrote it", async () => {
        const { em } = managerOf()
        const { runner, bus } = await build(em)
        const job = { jobId: "job-1", kind: "generate", fencingToken: 4, currentStep: null, payload: PAYLOAD }

        await expect(runner.runJob(job)).resolves.toBeUndefined()

        expect(bus.writes).toEqual([completedAs("done")])
    })

    it("publishes nothing for a job of another shape", async () => {
        const { runner, bus } = await build(mockEntityManager())
        const job = { jobId: "job-2", kind: "generate", fencingToken: 1, currentStep: null, payload: { other: true } }

        await expect(runner.runJob(job)).resolves.toBeUndefined()

        expect(bus.writes).toEqual([])
    })

    it("lets a failure to publish undo the finishing write, so nothing is metered", async () => {
        const { em } = managerOf()
        const { runner, bus, usage } = await build(em)
        bus.failNext("publish", new Error("bus down"))

        await expect(runner.run(PAYLOAD)).rejects.toThrow("bus down")

        expect(usage.record).not.toHaveBeenCalled()
    })
})

describe("GenerationRunnerService", () => {
    it("runs the prompt on the AI endpoint as a plain model answer, writes the text and meters it", async () => {
        const { em, finisher } = managerOf()
        const { runner, ai, usage, bus } = await build(em)

        await expect(runner.run(PAYLOAD)).resolves.toBe("done")

        expect(ai.chat.mock.calls).toEqual([
            [
                {
                    messages: [
                        { role: "user", content: "hi" },
                        { role: "system", content: "Answer with ONLY the requested text. No preface, no explanation." },
                    ],
                    json: false,
                    schema: null,
                    timeoutMs: 17_000,
                    context: null,
                    affinity: "w1",
                },
            ],
        ])
        expect(em.findOne).toHaveBeenCalledWith(AiGenerationEntity, FIND_OPTIONS)
        expect(em.update).toHaveBeenCalledWith(
            AiGenerationEntity,
            { id: "g1", workspaceId: "w1", status: "queued" },
            { status: "running" },
        )
        expect(finisher?.callsOf("set")).toEqual([
            [
                {
                    status: "done",
                    output: { text: "hello" },
                    usage: USAGE,
                    timings: { model_ms: 1500, total_ms: 1500 },
                    finishedAt: new Date("2026-10-12T10:00:01.500Z"),
                },
            ],
        ])
        expect(finisher?.callsOf("where")).toEqual([[{ id: "g1", workspaceId: "w1", status: OPEN }]])
        expect(finisher?.callsOf("returning")).toEqual([["usage_kind, module"]])
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: "w1",
            kind: "relay",
            module: "office",
            usage: USAGE,
            completionChars: 5,
        })
        expect(bus.writes).toEqual([completedAs("done")])
    })

    it("asks for one JSON object when the generation is a JSON one", async () => {
        const { em } = managerOf(generationRow({ input: { ...INPUT, response_format: "json" } }))
        const { runner, ai } = await build(em)

        await expect(runner.run(PAYLOAD)).resolves.toBe("done")

        expect(ai.chat.mock.calls[0]?.[0]).toMatchObject({ json: true, schema: null })
        expect(ai.chat.mock.calls[0]?.[0].messages.at(-1)).toEqual({
            role: "system",
            content: "Answer with ONLY the JSON object described above. No prose, no code fences.",
        })
    })

    it("counts what the endpoint did not report as zero", async () => {
        const { em, finisher } = managerOf(generationRow({ status: "running" }))
        const { runner } = await build(em, {
            answer: {
                ...ANSWER,
                text: "ok",
                usage: { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null },
            },
        })

        await expect(runner.run(PAYLOAD)).resolves.toBe("done")

        expect(finisher?.callsOf("set")).toEqual([
            [
                expect.objectContaining({
                    output: { text: "ok" },
                    usage: { prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, cost: 0, model: "m" },
                }),
            ],
        ])
    })
})

describe("GenerationRunnerService", () => {
    it("leaves a row the caller cancelled alone and meters nothing", async () => {
        const { em } = managerOf(generationRow(), [])
        const { runner, usage, bus } = await build(em)

        await expect(runner.run(PAYLOAD)).resolves.toBe("dropped")
        expect(usage.record).not.toHaveBeenCalled()
        expect(bus.writes).toEqual([])
    })

    it.each<[string, unknown]>([
        ["no row list", undefined],
        ["a row that is no record", [null]],
        ["a row without a usage kind", [{ module: "office" }]],
        ["a row without a module", [{ usage_kind: "relay" }]],
    ])("treats a finishing write that answered %s as a dropped row", async (_name, raw) => {
        const { em } = managerOf(generationRow(), null)
        queueQueryBuilders(em, [{ execute: { raw } }])
        const { runner, usage, bus } = await build(em)

        await expect(runner.run(PAYLOAD)).resolves.toBe("dropped")
        expect(usage.record).not.toHaveBeenCalled()
        expect(bus.writes).toEqual([])
    })

    it("drops a payload of another shape", async () => {
        const em = mockEntityManager()
        const { runner } = await build(em)

        await expect(runner.run({ orderId: "o1" })).resolves.toBe("dropped")
        expect(em.findOne).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })

    it("drops a generation that is gone or no longer waiting", async () => {
        const gone = await build(managerOf(null, null).em)
        const ended = await build(managerOf(generationRow({ status: "cancelled" }), null).em)

        await expect(gone.runner.run(PAYLOAD)).resolves.toBe("dropped")
        await expect(ended.runner.run(PAYLOAD)).resolves.toBe("dropped")
        expect(gone.ai.chat).not.toHaveBeenCalled()
        expect(ended.ai.chat).not.toHaveBeenCalled()
    })

    it("writes the failure on the row when the AI endpoint is not configured", async () => {
        const { em } = managerOf(generationRow(), null)
        const { runner, ai, bus } = await build(em, { available: false })

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(ai.chat).not.toHaveBeenCalled()
        expect(em.update).toHaveBeenCalledWith(
            AiGenerationEntity,
            { id: "g1", workspaceId: "w1", status: OPEN },
            {
                status: "error",
                error: "ai_not_configured",
                timings: { total_ms: 0 },
                finishedAt: new Date("2026-10-12T10:00:00.000Z"),
            },
        )
        expect(bus.writes).toEqual([completedAs("error")])
    })
})

describe("GenerationRunnerService", () => {
    it("writes an unanswered call as a failure, logs it and books the failed try (estimated, never billed)", async () => {
        const { em } = managerOf(generationRow(), null)
        const { runner, usage, logger, bus } = await build(em, { answer: null })

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(logger.warn).toHaveBeenCalledWith(AiGenerationsLogEvent.GenerationUnanswered, {
            purpose: "relay",
            timedOut: false,
        })
        expect(em.update).toHaveBeenLastCalledWith(
            AiGenerationEntity,
            { id: "g1", workspaceId: "w1", status: OPEN },
            {
                status: "error",
                error: "no_answer",
                timings: { model_ms: 1500, total_ms: 1500 },
                finishedAt: new Date("2026-10-12T10:00:01.500Z"),
            },
        )
        expect(usage.record).toHaveBeenCalledTimes(1)
        expect(usage.record.mock.calls[0]?.[0]).toMatchObject({
            workspaceId: "w1",
            usage: null,
            completionChars: 0,
            model: "work",
            failure: "no_answer",
        })
        expect(bus.writes).toEqual([completedAs("error")])
    })

    it("cancels a generation whose model call gave no answer by its deadline", async () => {
        const { em } = managerOf(generationRow(), null)
        const { runner, usage, bus } = await build(em, { answer: null, takesMs: 17_000 })

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(em.findOne.mock.calls).toEqual([[AiGenerationEntity, FIND_OPTIONS]])
        expect(em.update.mock.calls).toEqual([STARTED, cancelledAt("2026-10-12T10:00:17.000Z")])
        expect(bus.writes).toEqual([completedAs("cancelled")])
        expect(usage.record.mock.calls.map(([entry]) => entry.failure)).toEqual(["timeout"])
    })
})
