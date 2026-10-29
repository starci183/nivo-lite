import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import type { GatewayClient, TurnResult } from "@modules/integrations/openclaw"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
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

interface Setup {
    enabled?: boolean
    turn?: TurnResult
}

const build = async (entityManager: MockEntityManager, setup: Setup = {}) => {
    fakeTransaction(entityManager)
    const clock = new FakeClock("2026-10-12T10:00:00.000Z")
    const gateway = mock<GatewayClient>({
        runTurn: jest.fn(() => {
            clock.advance(1500)
            return Promise.resolve(setup.turn ?? { text: "hello", usage: USAGE, timings: { model_ms: 900 } })
        }),
    })
    Object.defineProperty(gateway, "enabled", { value: setup.enabled ?? true })
    const sync = mock<AgentSyncService>({
        ensureInternalAgent: jest.fn(() => {
            clock.advance(100)
            return Promise.resolve("ws-12345678-nivo")
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
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: AgentSyncService, useValue: sync },
            { provide: EVENT_BUS, useValue: bus },
        ],
    }).compile()
    return { runner: moduleRef.get(GenerationRunnerService), clock, gateway, sync, usage, logger, bus }
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
    it("runs the prompt on the internal agent, writes the text and meters it", async () => {
        const { em, finisher } = managerOf()
        const { runner, gateway, sync, usage, bus } = await build(em)

        await expect(runner.run(PAYLOAD)).resolves.toBe("done")

        expect(sync.ensureInternalAgent).toHaveBeenCalledWith("w1")
        expect(gateway.runTurn).toHaveBeenCalledWith(
            {
                agentId: "ws-12345678-nivo",
                threadKey: "agent:ws-12345678-nivo:explicit:model-run-g1",
                message: [
                    "[REQUEST: follow these instructions exactly]",
                    "(no extra instructions)",
                    "",
                    "[INPUT]",
                    "hi",
                    "",
                    "[OUTPUT] Answer with ONLY the requested text. No preface, no explanation.",
                ].join("\n"),
                idempotencyKey: "gen-g1",
                timeoutMs: 16_900,
            },
            expect.any(AbortSignal),
        )
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
                    timings: { model_ms: 900, ready_ms: 100, total_ms: 1600 },
                    finishedAt: new Date("2026-10-12T10:00:01.600Z"),
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
})

describe("GenerationRunnerService", () => {
    it("subtracts the time spent setting up the agent from the turn budget", async () => {
        const { em, finisher } = managerOf()
        const { runner, clock, sync, gateway } = await build(em)
        sync.ensureInternalAgent.mockImplementation(() => {
            clock.advance(4500)
            return Promise.resolve("ws-12345678-nivo")
        })

        await expect(runner.run(PAYLOAD)).resolves.toBe("done")

        expect(sync.ensureInternalAgent.mock.calls).toEqual([["w1"]])
        expect(gateway.runTurn.mock.calls).toEqual([
            [
                {
                    agentId: "ws-12345678-nivo",
                    threadKey: "agent:ws-12345678-nivo:explicit:model-run-g1",
                    message: [
                        "[REQUEST: follow these instructions exactly]",
                        "(no extra instructions)",
                        "",
                        "[INPUT]",
                        "hi",
                        "",
                        "[OUTPUT] Answer with ONLY the requested text. No preface, no explanation.",
                    ].join("\n"),
                    idempotencyKey: "gen-g1",
                    timeoutMs: 12_500,
                },
                expect.any(AbortSignal),
            ],
        ])
        const signal = gateway.runTurn.mock.calls[0]?.[1]
        expect(signal).toBeInstanceOf(AbortSignal)
        expect(signal?.aborted).toBe(false)
        expect(finisher?.callsOf("set")).toEqual([
            [
                {
                    status: "done",
                    output: { text: "hello" },
                    usage: USAGE,
                    timings: { model_ms: 900, ready_ms: 4500, total_ms: 6000 },
                    finishedAt: new Date("2026-10-12T10:00:06.000Z"),
                },
            ],
        ])
    })

    it("writes the text without usage when the gateway reported none", async () => {
        const { em, finisher } = managerOf(generationRow({ status: "running" }))
        const { runner } = await build(em, { turn: { text: "ok", usage: null, timings: {} } })

        await expect(runner.run(PAYLOAD)).resolves.toBe("done")

        expect(finisher?.callsOf("set")).toEqual([
            [
                {
                    status: "done",
                    output: { text: "ok" },
                    usage: null,
                    timings: { ready_ms: 100, total_ms: 1600 },
                    finishedAt: new Date("2026-10-12T10:00:01.600Z"),
                },
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
        expect(gone.gateway.runTurn).not.toHaveBeenCalled()
        expect(ended.gateway.runTurn).not.toHaveBeenCalled()
    })

    it("writes the failure on the row when no gateway is configured", async () => {
        const { em } = managerOf(generationRow(), null)
        const { runner, sync, bus } = await build(em, { enabled: false })

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(sync.ensureInternalAgent).not.toHaveBeenCalled()
        expect(em.update).toHaveBeenCalledWith(
            AiGenerationEntity,
            { id: "g1", workspaceId: "w1", status: OPEN },
            {
                status: "error",
                error: "openclaw_not_configured",
                timings: { total_ms: 0 },
                finishedAt: new Date("2026-10-12T10:00:00.000Z"),
            },
        )
        expect(bus.writes).toEqual([completedAs("error")])
    })
})

describe("GenerationRunnerService", () => {
    it("writes an empty answer as a failure", async () => {
        const { em } = managerOf(generationRow(), null)
        const { runner } = await build(em, { turn: { text: "  ", usage: USAGE, timings: {} } })

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(em.update).toHaveBeenLastCalledWith(
            AiGenerationEntity,
            { id: "g1", workspaceId: "w1", status: OPEN },
            {
                status: "error",
                error: "empty answer",
                timings: { ready_ms: 100, total_ms: 1600 },
                finishedAt: new Date("2026-10-12T10:00:01.600Z"),
            },
        )
    })

    it("writes the failure of the gateway on the row and logs it", async () => {
        const { em } = managerOf(generationRow(), null)
        const { runner, gateway, logger, bus } = await build(em)
        const failure = new Error("gateway closed")
        gateway.runTurn.mockRejectedValue(failure)

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(logger.error).toHaveBeenCalledWith(AiGenerationsLogEvent.GenerationFailed, failure, { purpose: "relay" })
        expect(em.update).toHaveBeenLastCalledWith(
            AiGenerationEntity,
            { id: "g1", workspaceId: "w1", status: OPEN },
            {
                status: "error",
                error: "gateway closed",
                timings: { total_ms: 100 },
                finishedAt: new Date("2026-10-12T10:00:00.100Z"),
            },
        )
        expect(bus.writes).toEqual([completedAs("error")])
    })
})

describe("GenerationRunnerService", () => {
    it("cancels a generation when its deadline passes while the internal agent is still being prepared", async () => {
        const { em } = managerOf(generationRow({ input: { ...INPUT, timeout_ms: 20 } }), null)
        const { runner, sync, gateway, usage, logger, bus } = await build(em)
        sync.ensureInternalAgent.mockReturnValue(new Promise<string>(() => {}))

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(sync.ensureInternalAgent.mock.calls).toEqual([["w1"]])
        expect(gateway.runTurn).not.toHaveBeenCalled()
        expect(usage.record).not.toHaveBeenCalled()
        expect(em.findOne.mock.calls).toEqual([[AiGenerationEntity, FIND_OPTIONS]])
        expect(em.update.mock.calls).toEqual([STARTED, cancelledAt("2026-10-12T10:00:00.000Z")])
        expect(bus.writes).toEqual([completedAs("cancelled")])
        expect(logger.error).toHaveBeenCalledWith(
            AiGenerationsLogEvent.GenerationFailed,
            expect.objectContaining({ name: "TimeoutError" }),
            { purpose: "relay" },
        )
    })

    it.each(["TimeoutError", "AbortError"])("cancels a generation when the turn rejects with %s", async (name) => {
        const { em } = managerOf(generationRow(), null)
        const { runner, gateway, usage, logger, bus } = await build(em)
        const failure = new Error("the deadline passed")
        failure.name = name
        gateway.runTurn.mockRejectedValue(failure)

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(logger.error.mock.calls).toEqual([
            [AiGenerationsLogEvent.GenerationFailed, failure, { purpose: "relay" }],
        ])
        expect(em.findOne.mock.calls).toEqual([[AiGenerationEntity, FIND_OPTIONS]])
        expect(em.update.mock.calls).toEqual([STARTED, cancelledAt("2026-10-12T10:00:00.100Z")])
        expect(bus.writes).toEqual([completedAs("cancelled")])
        expect(usage.record).not.toHaveBeenCalled()
    })
})
