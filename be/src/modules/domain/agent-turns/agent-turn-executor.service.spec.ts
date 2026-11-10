import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentWorkSettingsService } from "@modules/domain/agent-work"
import type { AgentTurnPlan, AgentWorkState } from "@modules/domain/agent-work"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentTurnExecutorService } from "./agent-turn-executor.service"
import { AGENT_TURN_RUNNER } from "./agent-turns.decorators"
import { AgentTurnsLogEvent } from "./agent-turns.log-events"
import type { AgentTurnRunner } from "./agent-turns.port"

const NOW = "2026-11-10T03:00:00.000Z"

const plan: AgentTurnPlan = {
    module: "accounting",
    runtimeAgentId: "ws-aaaa1111-accounting",
    threadKey: "agent:ws-aaaa1111-accounting:work",
    message: "the words",
    timeoutMs: 120_000,
}

const state = (over: Partial<AgentWorkState> = {}): AgentWorkState => ({
    agentId: "agent-1",
    workEnabled: true,
    failures: 0,
    breakerUntil: null,
    lastTurnAt: null,
    backgroundDay: null,
    backgroundTurns: 0,
    ...over,
})

interface Options {
    readonly configured?: boolean
    readonly state?: AgentWorkState
    readonly cap?: number
    readonly quota?: boolean
}

const build = async ({ configured = true, state: agentState = state(), cap = 200, quota = false }: Options = {}) => {
    const clock = new FakeClock(NOW)
    const runner = mock<AgentTurnRunner>({
        configured: jest.fn(() => configured),
        run: jest.fn(() => {
            clock.advance(800)
            return Promise.resolve({
                text: "model words",
                usage: { prompt_tokens: 12, completion_tokens: 5, cached_tokens: 0, cost: 0.02, model: "p/m" },
                runtimeAgentId: plan.runtimeAgentId,
            })
        }),
    })
    const settings = mock<AgentWorkSettingsService>({
        stateOf: jest.fn(() => Promise.resolve(agentState)),
        settingsOf: jest.fn(() =>
            Promise.resolve({ workspaceId: "ws-1", workEnabled: true, road: "core" as const, backgroundDailyCap: cap }),
        ),
    })
    const usage = mock<UsageGateService>({
        blockedBy: jest.fn(() => Promise.resolve(quota ? { message: "used up" } : null)),
        record: jest.fn(() => Promise.resolve()),
    })
    const logger = mock<Logger>()
    const runs = mock<AgentRunsService>({ runIdOfWake: jest.fn(() => Promise.resolve("run-7")) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTurnExecutorService,
            { provide: AGENT_TURN_RUNNER, useValue: runner },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: AgentWorkSettingsService, useValue: settings },
            { provide: UsageGateService, useValue: usage },
            { provide: AgentRunsService, useValue: runs },
        ],
    }).compile()
    return { executor: moduleRef.get(AgentTurnExecutorService), runner, settings, usage, logger, runs }
}

const signal = new AbortController().signal

describe("AgentTurnExecutorService > a turn that runs", () => {
    it("runs the plan with the wake and fence as replay key, and returns the model's text as the proposal with its usage", async () => {
        const { executor, runner } = await build()
        const turn = agentTurnViewOf({ source: "tag", wakeId: "wake-9", fence: 4 })

        const run = await executor.run(turn, plan, signal)

        expect(runner.run).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                module: "accounting",
                runtimeAgentId: "ws-aaaa1111-accounting",
                threadKey: "agent:ws-aaaa1111-accounting:work",
                message: "the words",
                runKey: "wake-wake-9:4",
                timeoutMs: 120_000,
            },
            signal,
        )
        expect(run).toEqual({
            kind: "proposal",
            proposal: { text: "model words" },
            usage: { model: "p/m", promptTokens: 12, completionTokens: 5, cost: 0.02, durationMs: 800 },
        })
    })

    it("meters a tag or background turn as agent work with the module", async () => {
        const { executor, usage } = await build()

        await executor.run(agentTurnViewOf({ source: "schedule" }), plan, signal)

        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "agent_work",
            module: "accounting",
            usage: { prompt_tokens: 12, completion_tokens: 5, cached_tokens: 0, cost: 0.02, model: "p/m" },
            completionChars: 11,
            runId: "run-7",
        })
    })

    it("books the call to the run of the wake, and to none when the wake has no run or the lookup fails", async () => {
        const { executor, usage, runs, logger } = await build()
        const turn = agentTurnViewOf({ source: "tag", wakeId: "wake-9" })

        await executor.run(turn, plan, signal)
        expect(runs.runIdOfWake).toHaveBeenCalledWith("ws-1", "wake-9")
        expect(usage.record).toHaveBeenLastCalledWith(expect.objectContaining({ runId: "run-7" }))

        runs.runIdOfWake.mockResolvedValueOnce(null)
        await executor.run(turn, plan, signal)
        expect(usage.record.mock.lastCall?.[0]).not.toHaveProperty("runId")

        runs.runIdOfWake.mockRejectedValueOnce(new Error("db down"))
        await expect(executor.run(turn, plan, signal)).resolves.toMatchObject({ kind: "proposal" })
        expect(usage.record.mock.lastCall?.[0]).not.toHaveProperty("runId")
        expect(logger.error).toHaveBeenCalledWith(AgentTurnsLogEvent.RunLookupFailed, expect.any(Error), {
            agentId: "agent-1",
            wakeId: "wake-9",
        })
    })

    it("meters a customer turn as a chat reply, as the legacy road does", async () => {
        const { executor, usage } = await build()

        await executor.run(agentTurnViewOf({ source: "customer" }), plan, signal)

        expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "chat_reply" }))
        expect(usage.blockedBy).toHaveBeenCalledWith("ws-1", "chat_reply", "vi")
    })

    it("reports zero tokens and no model when the runtime sent no usage", async () => {
        const { executor, runner } = await build()
        runner.run.mockResolvedValue({ text: "x", usage: null, runtimeAgentId: plan.runtimeAgentId })

        const run = await executor.run(agentTurnViewOf({ source: "tag" }), plan, signal)

        expect(run).toMatchObject({ usage: { model: null, promptTokens: 0, completionTokens: 0, cost: 0 } })
    })

    it("lets a failure of the runtime reach the drain, which retries the wake, and meters the call by what was sent", async () => {
        const { executor, runner, usage } = await build()
        const cause = new Error("gateway down")
        runner.run.mockRejectedValue(cause)

        await expect(executor.run(agentTurnViewOf({ source: "tag" }), plan, signal)).rejects.toBe(cause)
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "agent_work",
            module: "accounting",
            usage: null,
            completionChars: 0,
            promptChars: 9,
            runId: "run-7",
        })
    })
})

describe("AgentTurnExecutorService > a customer turn the runtime fails", () => {
    it("is blocked as unavailable at once and logged, and metered by what was sent like any failed run", async () => {
        const { executor, runner, usage, logger } = await build()
        runner.run.mockRejectedValue(new Error("gateway down"))

        const run = await executor.run(agentTurnViewOf({ source: "customer" }), plan, signal)

        expect(run).toEqual({ kind: "blocked", reason: "openclaw_unavailable" })
        expect(usage.record).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "chat_reply", usage: null, completionChars: 0 }),
        )
        expect(logger.error).toHaveBeenCalledWith(AgentTurnsLogEvent.TurnFailed, expect.any(Error), {
            agentId: "agent-1",
            wakeId: "wake-1",
        })
    })
})

describe("AgentTurnExecutorService > a turn that is blocked", () => {
    const blocked = async (options: Options, source: "customer" | "tag" | "internal") => {
        const built = await build(options)
        const run = await built.executor.run(agentTurnViewOf({ source }), plan, signal)
        return { ...built, run }
    }

    it("blocks every turn while the runtime is not configured, before it reads anything", async () => {
        const { run, settings, runner } = await blocked({ configured: false }, "tag")

        expect(run).toEqual({ kind: "blocked", reason: "openclaw_not_configured" })
        expect(settings.stateOf).not.toHaveBeenCalled()
        expect(runner.run).not.toHaveBeenCalled()
    })

    it("sends a customer straight to the holding line while the breaker is open, and logs why", async () => {
        const { run, runner, logger } = await blocked(
            { state: state({ breakerUntil: new Date("2026-11-10T03:10:00.000Z") }) },
            "customer",
        )

        expect(run).toEqual({ kind: "blocked", reason: "breaker" })
        expect(runner.run).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(AgentTurnsLogEvent.TurnBlocked, {
            agentId: "agent-1",
            wakeId: "wake-1",
            reason: "breaker",
        })
    })

    it("stops a background turn at the day's cap", async () => {
        const { run } = await blocked(
            { state: state({ backgroundDay: "2026-11-10", backgroundTurns: 3 }), cap: 3 },
            "internal",
        )

        expect(run).toEqual({ kind: "blocked", reason: "daily_cap" })
    })

    it("does not stop a tag at the cap", async () => {
        const { run } = await blocked(
            { state: state({ backgroundDay: "2026-11-10", backgroundTurns: 3 }), cap: 3 },
            "tag",
        )

        expect(run.kind).toBe("proposal")
    })

    it("blocks a turn whose workspace used up its allowance, without asking the model", async () => {
        const { run, runner, usage } = await blocked({ quota: true }, "tag")

        expect(run).toEqual({ kind: "blocked", reason: "quota" })
        expect(usage.blockedBy).toHaveBeenCalledWith("ws-1", "agent_work", "vi")
        expect(runner.run).not.toHaveBeenCalled()
    })
})

describe("AgentTurnExecutorService > plans carrying a picture", () => {
    it("preserves the image payload while retaining the wake replay key and metered result", async () => {
        const { executor, runner, usage } = await build()
        const attachments = [{ fileName: "receipt.png", mimeType: "image/png", content: "AQID" }]
        const turn = agentTurnViewOf({ source: "customer" })

        await expect(executor.run(turn, { ...plan, attachments }, signal)).resolves.toEqual({
            kind: "proposal",
            proposal: { text: "model words" },
            usage: { model: "p/m", promptTokens: 12, completionTokens: 5, cost: 0.02, durationMs: 800 },
        })

        expect(runner.run).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                module: "accounting",
                runtimeAgentId: "ws-aaaa1111-accounting",
                threadKey: "agent:ws-aaaa1111-accounting:work",
                message: "the words",
                attachments,
                runKey: "wake-wake-1:3",
                timeoutMs: 120_000,
            },
            signal,
        )
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "chat_reply",
            module: "accounting",
            usage: { prompt_tokens: 12, completion_tokens: 5, cached_tokens: 0, cost: 0.02, model: "p/m" },
            completionChars: 11,
            runId: "run-7",
        })
    })
})
