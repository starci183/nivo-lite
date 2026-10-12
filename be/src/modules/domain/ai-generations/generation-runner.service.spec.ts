import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import type { GatewayClient, TurnResult } from "@modules/integrations/openclaw"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { AI_GENERATIONS_USAGE } from "./ai-generations.decorators"
import { AiGenerationsLogEvent } from "./ai-generations.log-events"
import type { UsageGate } from "./ai-generations.port"
import { GenerationRunnerService } from "./generation-runner.service"
import { FAIL_GENERATION, FIND_GENERATION, FINISH_GENERATION, START_GENERATION } from "./persistence/ai-generations.sql"

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
    const moduleRef = await Test.createTestingModule({
        providers: [
            GenerationRunnerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: AI_GENERATIONS_USAGE, useValue: usage },
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: AgentSyncService, useValue: sync },
        ],
    }).compile()
    return { runner: moduleRef.get(GenerationRunnerService), gateway, sync, usage, logger }
}

describe("GenerationRunnerService", () => {
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
                message: expect.stringContaining("[INPUT]\nhi"),
                idempotencyKey: "gen-g1",
                timeoutMs: 17_000,
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
})
