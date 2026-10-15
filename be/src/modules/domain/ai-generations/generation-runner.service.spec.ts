import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import type { GatewayClient, TurnResult } from "@modules/integrations/openclaw"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { JobClaims } from "@modules/platform/jobs"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { AI_GENERATIONS_COMPLETION, AI_GENERATIONS_USAGE } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { GenerationCompletion, UsageGate } from "./ai-generations.port"
import { AiGenerationsError, AiGenerationsErrorCode } from "./errors/ai-generations.error"
import { GenerationRunnerService } from "./generation-runner.service"
import {
    CANCEL_GENERATION,
    FAIL_GENERATION,
    FIND_GENERATION,
    FINISH_GENERATION,
    START_GENERATION,
} from "./persistence/ai-generations.sql"

const ROW = {
    id: "g1",
    workspace_id: "w1",
    purpose: "relay",
    module: "office",
    usage_kind: "relay",
    status: "queued",
    input: { messages: [{ role: "user", content: "hi" }], response_format: "text", timeout_ms: 20_000 },
}

const USAGE = { prompt_tokens: 10, completion_tokens: 5, cached_tokens: 0, cost: 0.1, model: "m" }

const PAYLOAD = { generationId: "g1", workspaceId: "w1" }

interface Setup {
    enabled?: boolean
    turn?: TurnResult
}

const build = async (entityManager: MockEntityManager, setup: Setup = {}) => {
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
    const claims = mock<JobClaims>()
    const completion = mock<GenerationCompletion>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GenerationRunnerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: AI_GENERATIONS_USAGE, useValue: usage },
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: AgentSyncService, useValue: sync },
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: AI_GENERATIONS_COMPLETION, useValue: completion },
        ],
    }).compile()
    return { runner: moduleRef.get(GenerationRunnerService), clock, gateway, sync, usage, logger, claims, completion }
}

describe("GenerationRunnerService", () => {
    it("fences the finished job at the apply step before handing the generation to its application", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [ROW]],
                [START_GENERATION, []],
                [FINISH_GENERATION, [{ usage_kind: "relay", module: "office" }]],
            ],
        })
        const { runner, claims, completion } = await build(em)
        const job = { jobId: "job-1", kind: "generate", fencingToken: 4, currentStep: null, payload: PAYLOAD }

        await expect(runner.runJob(job)).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 4, step: "apply-result" }]])
        expect(completion.completeGeneration.mock.calls).toEqual([["w1", "g1"]])
    })

    it("acknowledges a job of another shape without fencing or completing anything", async () => {
        const { runner, claims, completion } = await build(mockEntityManager())
        const job = { jobId: "job-2", kind: "generate", fencingToken: 1, currentStep: null, payload: { other: true } }

        await expect(runner.runJob(job)).resolves.toBeUndefined()

        expect(claims.advance).not.toHaveBeenCalled()
        expect(completion.completeGeneration).not.toHaveBeenCalled()
    })

    it("rejects a generation job when the claims port is missing", async () => {
        const em = mockEntityManager({ query: [FIND_GENERATION, []] })
        const { runner, claims, completion } = await build(em)
        Object.defineProperty(runner, "claims", { value: undefined })
        const job = { jobId: "job-3", kind: "generate", fencingToken: 2, currentStep: null, payload: PAYLOAD }

        await expect(runner.runJob(job)).rejects.toEqual(
            new AiGenerationsError({
                code: AiGenerationsErrorCode.GenerationFailed,
                params: { reason: "job_claims", message: "" },
            }),
        )

        expect(em.query.mock.calls).toEqual([[FIND_GENERATION, ["g1", "w1"]]])
        expect(claims.advance).not.toHaveBeenCalled()
        expect(completion.completeGeneration).not.toHaveBeenCalled()
    })

    it("fences a generation job when no completion port is configured", async () => {
        const em = mockEntityManager({ query: [FIND_GENERATION, []] })
        const { runner, claims, completion } = await build(em)
        Object.defineProperty(runner, "completion", { value: undefined })
        const job = { jobId: "job-4", kind: "generate", fencingToken: 3, currentStep: null, payload: PAYLOAD }

        await expect(runner.runJob(job)).resolves.toBeUndefined()

        expect(em.query.mock.calls).toEqual([[FIND_GENERATION, ["g1", "w1"]]])
        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-4", expectedFencingToken: 3, step: "apply-result" }]])
        expect(completion.completeGeneration).not.toHaveBeenCalled()
    })

    it("runs the prompt on the internal agent, writes the text and meters it", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [ROW]],
                [START_GENERATION, []],
                [FINISH_GENERATION, [{ usage_kind: "relay", module: "office" }]],
            ],
        })
        const { runner, gateway, sync, usage } = await build(em)

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
        expect(em.query).toHaveBeenCalledWith(START_GENERATION, ["g1", "w1"])
        expect(em.query).toHaveBeenCalledWith(FINISH_GENERATION, [
            "g1",
            "w1",
            '{"text":"hello"}',
            JSON.stringify(USAGE),
            '{"model_ms":900,"ready_ms":100,"total_ms":1600}',
            "2026-10-12T10:00:01.600Z",
        ])
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: "w1",
            kind: "relay",
            module: "office",
            usage: USAGE,
            completionChars: 5,
        })
    })

    it("subtracts the time spent setting up the agent from the turn budget", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [ROW]],
                [START_GENERATION, []],
                [FINISH_GENERATION, [{ usage_kind: "relay", module: "office" }]],
            ],
        })
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
        expect(em.query).toHaveBeenLastCalledWith(FINISH_GENERATION, [
            "g1",
            "w1",
            '{"text":"hello"}',
            JSON.stringify(USAGE),
            '{"model_ms":900,"ready_ms":4500,"total_ms":6000}',
            "2026-10-12T10:00:06.000Z",
        ])
    })

    it("writes the text without usage when the gateway reported none", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [{ ...ROW, status: "running" }]],
                [START_GENERATION, []],
                [FINISH_GENERATION, [{ usage_kind: "relay", module: "office" }]],
            ],
        })
        const { runner } = await build(em, { turn: { text: "ok", usage: null, timings: {} } })

        await expect(runner.run(PAYLOAD)).resolves.toBe("done")

        expect(em.query).toHaveBeenCalledWith(FINISH_GENERATION, [
            "g1",
            "w1",
            '{"text":"ok"}',
            null,
            '{"ready_ms":100,"total_ms":1600}',
            "2026-10-12T10:00:01.600Z",
        ])
    })

    it("leaves a row the caller cancelled alone and meters nothing", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [ROW]],
                [START_GENERATION, []],
                [FINISH_GENERATION, []],
            ],
        })
        const { runner, usage } = await build(em)

        await expect(runner.run(PAYLOAD)).resolves.toBe("dropped")
        expect(usage.record).not.toHaveBeenCalled()
    })

    it("drops a payload of another shape", async () => {
        const em = mockEntityManager()
        const { runner } = await build(em)

        await expect(runner.run({ orderId: "o1" })).resolves.toBe("dropped")
        expect(em.query).not.toHaveBeenCalled()
    })

    it("drops a generation that is gone or no longer waiting", async () => {
        const gone = await build(mockEntityManager({ query: [FIND_GENERATION, []] }))
        const ended = await build(mockEntityManager({ query: [FIND_GENERATION, [{ ...ROW, status: "cancelled" }]] }))

        await expect(gone.runner.run(PAYLOAD)).resolves.toBe("dropped")
        await expect(ended.runner.run(PAYLOAD)).resolves.toBe("dropped")
        expect(gone.gateway.runTurn).not.toHaveBeenCalled()
        expect(ended.gateway.runTurn).not.toHaveBeenCalled()
    })

    it("writes the failure on the row when no gateway is configured", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [ROW]],
                [START_GENERATION, []],
                [FAIL_GENERATION, []],
            ],
        })
        const { runner, sync } = await build(em, { enabled: false })

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(sync.ensureInternalAgent).not.toHaveBeenCalled()
        expect(em.query).toHaveBeenCalledWith(FAIL_GENERATION, [
            "g1",
            "w1",
            "openclaw_not_configured",
            '{"total_ms":0}',
            "2026-10-12T10:00:00.000Z",
        ])
    })

    it("writes an empty answer as a failure", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [ROW]],
                [START_GENERATION, []],
                [FAIL_GENERATION, []],
            ],
        })
        const { runner } = await build(em, { turn: { text: "  ", usage: USAGE, timings: {} } })

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(em.query).toHaveBeenLastCalledWith(FAIL_GENERATION, [
            "g1",
            "w1",
            "empty answer",
            '{"ready_ms":100,"total_ms":1600}',
            "2026-10-12T10:00:01.600Z",
        ])
    })

    it("writes the failure of the gateway on the row and logs it", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [ROW]],
                [START_GENERATION, []],
                [FAIL_GENERATION, []],
            ],
        })
        const { runner, gateway, logger } = await build(em)
        const failure = new Error("gateway closed")
        gateway.runTurn.mockRejectedValue(failure)

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(logger.error).toHaveBeenCalledWith(AiGenerationsLogEvent.GenerationFailed, failure, { purpose: "relay" })
        expect(em.query).toHaveBeenLastCalledWith(FAIL_GENERATION, [
            "g1",
            "w1",
            "gateway closed",
            '{"total_ms":100}',
            "2026-10-12T10:00:00.100Z",
        ])
    })

    it("cancels a generation when its deadline passes while the internal agent is still being prepared", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [{ ...ROW, input: { ...ROW.input, timeout_ms: 20 } }]],
                [START_GENERATION, []],
                [CANCEL_GENERATION, []],
            ],
        })
        const { runner, sync, gateway, usage, logger } = await build(em)
        sync.ensureInternalAgent.mockReturnValue(new Promise<string>(() => {}))

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(sync.ensureInternalAgent.mock.calls).toEqual([["w1"]])
        expect(gateway.runTurn).not.toHaveBeenCalled()
        expect(usage.record).not.toHaveBeenCalled()
        expect(em.query.mock.calls).toEqual([
            [FIND_GENERATION, ["g1", "w1"]],
            [START_GENERATION, ["g1", "w1"]],
            [CANCEL_GENERATION, ["g1", "w1", "2026-10-12T10:00:00.000Z"]],
        ])
        expect(logger.error).toHaveBeenCalledWith(
            AiGenerationsLogEvent.GenerationFailed,
            expect.objectContaining({ name: "TimeoutError" }),
            { purpose: "relay" },
        )
    })

    it.each(["TimeoutError", "AbortError"])("cancels a generation when the turn rejects with %s", async (name) => {
        const em = mockEntityManager({
            query: [
                [FIND_GENERATION, [ROW]],
                [START_GENERATION, []],
                [CANCEL_GENERATION, []],
            ],
        })
        const { runner, gateway, usage, logger } = await build(em)
        const failure = new Error("the deadline passed")
        failure.name = name
        gateway.runTurn.mockRejectedValue(failure)

        await expect(runner.run(PAYLOAD)).resolves.toBe("error")

        expect(logger.error.mock.calls).toEqual([
            [AiGenerationsLogEvent.GenerationFailed, failure, { purpose: "relay" }],
        ])
        expect(em.query.mock.calls).toEqual([
            [FIND_GENERATION, ["g1", "w1"]],
            [START_GENERATION, ["g1", "w1"]],
            [CANCEL_GENERATION, ["g1", "w1", "2026-10-12T10:00:00.100Z"]],
        ])
        expect(usage.record).not.toHaveBeenCalled()
    })
})
