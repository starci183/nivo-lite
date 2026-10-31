import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { agentTurnQueueProviderOf, agentTurnViewOf as turn } from "@tests/fixtures/builders/agent-work.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentDrainService } from "./agent-drain.service"
import { AgentTurnsService } from "./agent-turns.service"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
import { AGENT_TURN_EXECUTOR } from "./agent-work.decorators"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentTurnUsage } from "./agent-work.contracts"
import type { AgentTurnExecutor, AgentTurnPlan, AgentWorkHandler } from "./agent-work.port"

const PAYLOAD = { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" }

const PLAN: AgentTurnPlan = {
    module: "chatbot",
    runtimeAgentId: "runtime-1",
    threadKey: "thread-1",
    message: "words",
    timeoutMs: 25_000,
}

const USAGE: AgentTurnUsage = { model: "p/m", promptTokens: 4, completionTokens: 2, cost: 0.1, durationMs: 800 }

const DONE = { status: "done" as const, reason: null, outcome: { sent: true } }

interface Options {
    readonly executor?: boolean
    readonly handler?: boolean
}

const build = async ({ executor = true, handler = true }: Options = {}) => {
    const turns = mock<AgentTurnsService>({
        begin: jest.fn().mockResolvedValue({ result: "begun", turn: turn() }),
        touch: jest.fn().mockResolvedValue(true),
        bind: jest.fn().mockResolvedValue(undefined),
        propose: jest.fn().mockResolvedValue("stored"),
        finish: jest.fn().mockResolvedValue({ fenced: false, more: false }),
    })
    const registered = mock<AgentWorkHandler>({
        sources: ["customer"],
        prepare: jest.fn().mockResolvedValue({ kind: "run", plan: PLAN }),
        settle: jest.fn().mockResolvedValue(DONE),
        holdOver: jest.fn().mockResolvedValue({ status: "done", reason: "holding_line", outcome: null }),
    })
    const runner = mock<AgentTurnExecutor>({
        run: jest.fn().mockResolvedValue({ kind: "proposal", proposal: { reply: "hi" }, usage: USAGE }),
    })
    const handlers = mock<AgentWorkHandlersService>({ of: jest.fn().mockReturnValue(handler ? registered : undefined) })
    const outbox = recordingQueueOutbox()
    const logger = mock<Logger>()
    const tx = fakeTransaction(mockEntityManager())
    const container = await Test.createTestingModule({
        providers: [
            AgentDrainService,
            { provide: AgentTurnsService, useValue: turns },
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: IDS, useValue: fakeIds() },
            { provide: LOGGER, useValue: logger },
            agentTurnQueueProviderOf(outbox),
            ...(executor ? [{ provide: AGENT_TURN_EXECUTOR, useValue: runner }] : []),
        ],
    }).compile()
    return {
        service: container.get(AgentDrainService),
        turns,
        handler: registered,
        executor: runner,
        outbox,
        logger,
        tx,
    }
}

type Fixture = Awaited<ReturnType<typeof build>>

describe("AgentDrainService.drain, a turn that runs", () => {
    it("takes a turn as one worker and runs the handler, the executor, the proposal and the settle in that order", async () => {
        const { service, turns, handler, executor } = await build()

        await service.drain(PAYLOAD)

        expect(turns.begin).toHaveBeenCalledWith(
            "agent-1",
            "conversation:conv-1",
            "00000000-0000-4000-8000-000000000001",
        )
        expect(handler.prepare).toHaveBeenCalledWith(turn(), expect.any(AbortSignal))
        expect(turns.bind).toHaveBeenCalledWith(turn(), "runtime-1", "thread-1")
        expect(executor.run).toHaveBeenCalledWith(turn(), PLAN, expect.any(AbortSignal))
        expect(turns.propose).toHaveBeenCalledWith(turn(), { reply: "hi" })
        expect(handler.settle).toHaveBeenCalledWith(turn(), { reply: "hi" }, expect.any(AbortSignal))
        expect(turns.finish).toHaveBeenCalledWith(turn(), {
            status: "done",
            reason: null,
            outcome: { sent: true },
            errorCode: null,
            usage: USAGE,
        })
        const order = [turns.bind, executor.run, turns.propose, handler.settle, turns.finish].map(
            (fn) => fn.mock.invocationCallOrder[0],
        )
        expect(order).toEqual([...order].sort((a, b) => (a ?? 0) - (b ?? 0)))
    })

    it("settles the proposal an earlier attempt stored and never asks the model again", async () => {
        const { service, turns, handler, executor } = await build()
        const stored = turn({ proposal: { reply: "stored" }, attempts: 2 })
        turns.begin.mockResolvedValue({ result: "begun", turn: stored })

        await service.drain(PAYLOAD)

        expect(handler.prepare).not.toHaveBeenCalled()
        expect(executor.run).not.toHaveBeenCalled()
        expect(turns.propose).not.toHaveBeenCalled()
        expect(handler.settle).toHaveBeenCalledWith(stored, { reply: "stored" }, expect.any(AbortSignal))
        expect(turns.finish).toHaveBeenCalledWith(stored, expect.objectContaining({ status: "done", usage: null }))
    })

    it("ends a wake the handler answers without a model call", async () => {
        const { service, turns, handler, executor } = await build()
        handler.prepare.mockResolvedValue({
            kind: "end",
            ending: { status: "skipped", reason: "no_work", outcome: null },
        })

        await service.drain(PAYLOAD)

        expect(executor.run).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(turn(), {
            status: "skipped",
            reason: "no_work",
            outcome: null,
            errorCode: null,
            usage: null,
        })
    })
})

describe("AgentDrainService.drain, a scope that has nothing to run", () => {
    it("ends quietly when the scope is busy, because the holder serves the wake", async () => {
        const { service, turns, handler, logger } = await build()
        turns.begin.mockResolvedValue({ result: "busy" })

        await service.drain(PAYLOAD)

        expect(logger.info).toHaveBeenCalledWith(AgentWorkLogEvent.TurnBusy, {
            agentId: "agent-1",
            scopeKey: "conversation:conv-1",
        })
        expect(handler.prepare).not.toHaveBeenCalled()
        expect(turns.finish).not.toHaveBeenCalled()
    })

    it.each(["idle", "killed"] as const)("ends quietly when the scope is %s", async (result) => {
        const { service, turns, handler } = await build()
        turns.begin.mockResolvedValue({ result })

        await service.drain(PAYLOAD)

        expect(handler.prepare).not.toHaveBeenCalled()
        expect(turns.finish).not.toHaveBeenCalled()
    })

    it("holds the wake for want of a handler", async () => {
        const { service, turns, logger } = await build({ handler: false })

        await service.drain(PAYLOAD)

        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.NoHandler, {
            agentId: "agent-1",
            source: "customer",
        })
        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            expect.objectContaining({ status: "held", reason: "no_handler" }),
        )
    })

    it("holds the wake for want of an executor, after the handler has prepared", async () => {
        const { service, turns, handler } = await build({ executor: false })

        await service.drain(PAYLOAD)

        expect(handler.prepare).toHaveBeenCalled()
        expect(turns.bind).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            expect.objectContaining({ status: "held", reason: "no_executor" }),
        )
    })
})

describe("AgentDrainService.drain, a turn that cannot be settled", () => {
    it("lets the handler answer when no turn can run, and stores no proposal", async () => {
        const { service, turns, handler, executor } = await build()
        executor.run.mockResolvedValue({ kind: "blocked", reason: "quota" })

        await service.drain(PAYLOAD)

        expect(handler.holdOver).toHaveBeenCalledWith(turn(), "quota")
        expect(turns.propose).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(turn(), {
            status: "done",
            reason: "holding_line",
            outcome: null,
            errorCode: null,
            usage: null,
        })
    })

    it("stops before settling when the lease moved on while the model ran", async () => {
        const { service, turns, handler, logger } = await build()
        turns.propose.mockResolvedValue("fenced")

        await service.drain(PAYLOAD)

        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFenced, { agentId: "agent-1", wakeId: "wake-1" })
        expect(handler.settle).not.toHaveBeenCalled()
        expect(turns.finish).not.toHaveBeenCalled()
    })

    it("refuses the proposal and holds the wake when work was switched off while the model ran", async () => {
        const { service, turns, handler } = await build()
        turns.propose.mockResolvedValue("killed")

        await service.drain(PAYLOAD)

        expect(handler.holdOver).toHaveBeenCalledWith(turn(), "killed")
        expect(handler.settle).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(turn(), expect.objectContaining({ status: "held", reason: "killed" }))
    })
})

describe("AgentDrainService.drain, a turn that fails or leaves more to do", () => {
    it("fails the wake with the code of a domain error and logs the cause", async () => {
        const { service, turns, handler, logger } = await build()
        const cause = new AgentWorkError({ code: AgentWorkErrorCode.AgentNotFound })
        handler.prepare.mockRejectedValue(cause)

        await service.drain(PAYLOAD)

        expect(logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFailed, cause, {
            agentId: "agent-1",
            wakeId: "wake-1",
        })
        expect(turns.finish).toHaveBeenCalledWith(turn(), {
            status: "failed",
            reason: "error",
            outcome: null,
            errorCode: AgentWorkErrorCode.AgentNotFound,
            usage: null,
        })
    })

    it("fails the wake with a generic code for any other error", async () => {
        const { service, turns, executor } = await build()
        executor.run.mockRejectedValue(new Error("socket closed"))

        await service.drain(PAYLOAD)

        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            expect.objectContaining({ status: "failed", errorCode: "AGENT_WORK_UNEXPECTED" }),
        )
    })

    it("starts the next drain in a transaction when another wake of the scope is due", async () => {
        const { service, turns, outbox, tx } = await build()
        turns.finish.mockResolvedValue({ fenced: false, more: true })

        await service.drain(PAYLOAD)

        expect(tx.commits).toBe(1)
        expect(outbox.jobsOf("agent_turn")).toEqual([{ queue: "agent_turn", payload: PAYLOAD }])
        expect(outbox.allInTransaction).toBe(true)
    })

    it("starts nothing when the lease was lost before the turn ended, even if wakes are due", async () => {
        const { service, turns, outbox, logger } = await build()
        turns.finish.mockResolvedValue({ fenced: true, more: true })

        await service.drain(PAYLOAD)

        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFenced, { agentId: "agent-1", wakeId: "wake-1" })
        expect(outbox.jobs).toEqual([])
    })
})

const whenAborted = (signal: AbortSignal): Promise<void> =>
    signal.aborted
        ? Promise.resolve()
        : new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))

interface SeenSignal {
    signal?: AbortSignal
}

const slowRun = (fixture: Fixture) => {
    const gate = new AbortController()
    const seen: SeenSignal = {}
    fixture.executor.run.mockImplementation(async (_turn, _plan, given) => {
        seen.signal = given
        await whenAborted(gate.signal)
        return { kind: "proposal", proposal: { reply: "hi" }, usage: null }
    })
    return { release: () => gate.abort(), seen }
}

describe("AgentDrainService.drain, the heartbeat", () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it("renews the lease every thirty seconds while the turn runs and stops when it ends", async () => {
        const fixture = await build()
        const { release } = slowRun(fixture)

        const done = fixture.service.drain(PAYLOAD)
        await jest.advanceTimersByTimeAsync(30_000)
        expect(fixture.turns.touch).toHaveBeenCalledTimes(1)
        expect(fixture.turns.touch).toHaveBeenCalledWith(turn())
        await jest.advanceTimersByTimeAsync(30_000)
        expect(fixture.turns.touch).toHaveBeenCalledTimes(2)

        release()
        await done
        await jest.advanceTimersByTimeAsync(120_000)
        expect(fixture.turns.touch).toHaveBeenCalledTimes(2)
    })

    it("aborts the signal the model call watches when the lease is lost", async () => {
        const fixture = await build()
        const { release, seen } = slowRun(fixture)
        fixture.turns.touch.mockResolvedValue(false)

        const done = fixture.service.drain(PAYLOAD)
        await jest.advanceTimersByTimeAsync(30_000)

        expect(seen.signal?.aborted).toBe(true)
        release()
        await done
    })

    it("logs a failed renewal and tries again at the next beat", async () => {
        const fixture = await build()
        const { release, seen } = slowRun(fixture)
        const cause = new Error("db down")
        fixture.turns.touch.mockRejectedValueOnce(cause)

        const done = fixture.service.drain(PAYLOAD)
        await jest.advanceTimersByTimeAsync(60_000)

        expect(fixture.logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.HeartbeatFailed, cause, {
            agentId: "agent-1",
            wakeId: "wake-1",
        })
        expect(fixture.turns.touch).toHaveBeenCalledTimes(2)
        expect(seen.signal?.aborted).toBe(false)
        release()
        await done
    })

    it("stops the heartbeat when the turn throws", async () => {
        const fixture = await build()
        fixture.handler.prepare.mockRejectedValue(new Error("boom"))

        await fixture.service.drain(PAYLOAD)
        await jest.advanceTimersByTimeAsync(90_000)

        expect(fixture.turns.touch).not.toHaveBeenCalled()
    })
})
