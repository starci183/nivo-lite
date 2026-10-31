import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { agentTurnViewOf as turn, agentWakeViewOf as endedWake } from "@tests/fixtures/builders/agent-work.builder"
import { AGENT_TURN_QUEUE_PRODUCER } from "@modules/queues/agent-turn"
import type { AgentTurnQueue } from "@modules/queues/agent-turn"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentDrainService } from "./agent-drain.service"
import { AgentTurnsService } from "./agent-turns.service"
import { AgentEndedWakesService } from "./agent-ended-wakes.service"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
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
    readonly handler?: boolean
}

const build = async ({ handler = true }: Options = {}) => {
    const turns = mock<AgentTurnsService>({
        begin: jest.fn().mockResolvedValue({ result: "begun", turn: turn(), ended: [] }),
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
    const handlers = mock<AgentWorkHandlersService>({
        of: jest.fn().mockReturnValue(handler ? registered : undefined),
        executorOf: jest.fn().mockReturnValue(runner),
    })
    const queue = mock<AgentTurnQueue>({ enqueueNextDrain: jest.fn().mockResolvedValue(undefined) })
    const endedWakes = mock<AgentEndedWakesService>({ tell: jest.fn().mockResolvedValue(undefined) })
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
            { provide: AGENT_TURN_QUEUE_PRODUCER, useValue: queue },
            { provide: AgentEndedWakesService, useValue: endedWakes },
        ],
    }).compile()
    const service = container.get(AgentDrainService)
    return { service, turns, handler: registered, handlers, executor: runner, queue, endedWakes, logger, tx }
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
        expect(turns.bind).toHaveBeenCalledWith(turn(), "runtime-1", "thread-1:agent-1")
        expect(executor.run).toHaveBeenCalledWith(
            turn(),
            { ...PLAN, threadKey: "thread-1:agent-1" },
            expect.any(AbortSignal),
        )
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
        turns.begin.mockResolvedValue({ result: "begun", turn: stored, ended: [] })

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
        turns.begin.mockResolvedValue({ result: "busy", ended: [] })

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
        turns.begin.mockResolvedValue({ result, ended: [] })

        await service.drain(PAYLOAD)

        expect(handler.prepare).not.toHaveBeenCalled()
        expect(turns.finish).not.toHaveBeenCalled()
    })

    it("hands the wakes begin ended to the ended-wakes service, whatever begin answered", async () => {
        const { service, turns, endedWakes } = await build()
        const ended = [{ state: "held" as const, wake: endedWake() }]
        turns.begin.mockResolvedValue({ result: "killed", ended })
        await service.drain(PAYLOAD)
        expect(turns.finish).not.toHaveBeenCalled()
        expect(endedWakes.tell).toHaveBeenCalledWith(ended)
    })

    it("holds the wake for want of an executor, after the handler has prepared", async () => {
        const { service, turns, handler, handlers } = await build()
        handlers.executorOf.mockReturnValue(undefined)
        await service.drain(PAYLOAD)
        expect(turns.bind).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(turn(), expect.objectContaining({ reason: "no_executor" }))
        expect(handler.prepare).toHaveBeenCalled()
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

    it("fails the wake with a generic code for any other error, and retries a tag silently while attempts remain", async () => {
        const { service, turns, executor, handler } = await build()
        const tag = turn({ source: "tag", attempts: 1, maxAttempts: 3 })
        turns.begin.mockResolvedValue({ result: "begun", turn: tag, ended: [] })
        executor.run.mockRejectedValue(new Error("socket closed"))

        await service.drain(PAYLOAD)

        expect(handler.holdOver).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(
            tag,
            expect.objectContaining({ status: "failed", errorCode: "AGENT_WORK_UNEXPECTED" }),
        )
    })
})

describe("AgentDrainService.drain, a runtime that is down", () => {
    it("gives a customer the holding line at once when the runtime is down, ends the wake and still counts the failure", async () => {
        const { service, turns, executor, handler } = await build()
        executor.run.mockRejectedValue(new Error("socket closed"))

        await service.drain(PAYLOAD)

        expect(handler.holdOver).toHaveBeenCalledWith(turn(), "error")
        expect(turns.propose).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(turn(), {
            status: "done",
            reason: "holding_line",
            outcome: null,
            errorCode: "AGENT_WORK_UNEXPECTED",
            usage: null,
        })
    })

    it.each(["tag", "internal", "schedule"] as const)(
        "gives up a %s wake on its last attempt: it is announced once through the handler and fails",
        async (source) => {
            const { service, turns, executor, handler, logger } = await build()
            const last = turn({ source, attempts: 3, maxAttempts: 3 })
            turns.begin.mockResolvedValue({ result: "begun", turn: last, ended: [] })
            executor.run.mockRejectedValue(new Error("socket closed"))

            await service.drain(PAYLOAD)

            expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.WakeDead, {
                agentId: "agent-1",
                wakeId: "wake-1",
            })
            expect(handler.holdOver).toHaveBeenCalledWith(last, "error")
            expect(turns.finish).toHaveBeenCalledWith(
                last,
                expect.objectContaining({ status: "failed", errorCode: "AGENT_WORK_UNEXPECTED" }),
            )
        },
    )

    it("fails the wake all the same when the hold-over line itself cannot be written, and logs why", async () => {
        const { service, turns, executor, handler, logger } = await build()
        const cause = new Error("channel down")
        executor.run.mockRejectedValue(new Error("socket closed"))
        handler.holdOver.mockRejectedValue(cause)

        await service.drain(PAYLOAD)

        expect(logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFailed, cause, {
            agentId: "agent-1",
            wakeId: "wake-1",
        })
        expect(turns.finish).toHaveBeenCalledWith(turn(), expect.objectContaining({ status: "failed" }))
    })

    it("fails the wake when it ran out of attempts and no handler is left to announce it", async () => {
        const { service, turns, handler, handlers } = await build()
        const last = turn({ attempts: 2, maxAttempts: 2 })
        turns.begin.mockResolvedValue({ result: "begun", turn: last, ended: [] })
        handler.prepare.mockRejectedValue(new Error("boom"))
        handlers.of.mockReturnValueOnce(handler).mockReturnValue(undefined)

        await service.drain(PAYLOAD)

        expect(turns.finish).toHaveBeenCalledWith(last, expect.objectContaining({ status: "failed" }))
    })
})

describe("AgentDrainService.drain, a turn that leaves more to do", () => {
    it("starts the next drain in a transaction when another wake of the scope is due", async () => {
        const { service, turns, queue, tx } = await build()
        turns.finish.mockResolvedValue({ fenced: false, more: true })

        await service.drain(PAYLOAD)

        expect(tx.commits).toBe(1)
        expect(queue.enqueueNextDrain).toHaveBeenCalledWith(PAYLOAD, "turn-1", expect.anything())
    })

    it("starts nothing when the lease was lost before the turn ended, even if wakes are due", async () => {
        const { service, turns, queue, logger } = await build()
        turns.finish.mockResolvedValue({ fenced: true, more: true })

        await service.drain(PAYLOAD)

        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFenced, { agentId: "agent-1", wakeId: "wake-1" })
        expect(queue.enqueueNextDrain).not.toHaveBeenCalled()
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
})

describe("AgentDrainService.drain, the heartbeat budget", () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it("leaves the lease to lapse and aborts the turn once it has used its beats", async () => {
        const fixture = await build()
        const { release, seen } = slowRun(fixture)

        const done = fixture.service.drain(PAYLOAD)
        await jest.advanceTimersByTimeAsync(20 * 30_000)
        expect(fixture.turns.touch).toHaveBeenCalledTimes(20)
        expect(seen.signal?.aborted).toBe(false)
        await jest.advanceTimersByTimeAsync(30_000)

        expect(fixture.turns.touch).toHaveBeenCalledTimes(20)
        expect(seen.signal?.aborted).toBe(true)
        expect(fixture.logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.TurnOverran, {
            agentId: "agent-1",
            wakeId: "wake-1",
        })
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
