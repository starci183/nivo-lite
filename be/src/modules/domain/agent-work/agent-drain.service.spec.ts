import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { agentTurnViewOf as turn, agentWakeViewOf as endedWake } from "@tests/fixtures/builders/agent-work.builder"
import { AGENT_TURN_QUEUE_PRODUCER, AgentTurnQueue } from "@modules/queues/agent-turn"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentDrainService } from "./agent-drain.service"
import { AgentTurnsService } from "./agent-turns.service"
import { AgentEndedWakesService } from "./agent-ended-wakes.service"
import { AgentWakeInterruptionService } from "./agent-wake-interruption.service"
import { AgentWorkHandlersService } from "./agent-work-handlers.service"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import { HEARTBEAT_MS, LEASE_SECONDS } from "./agent-work.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentTurnUsage } from "./agent-work.contracts"
import type { AgentTurnExecutor, AgentTurnPlan, AgentWorkFlow, AgentWorkHandler } from "./agent-work.port"

const PAYLOAD = { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" }

const PLAN: AgentTurnPlan = {
    module: "chatbot",
    runtimeAgentId: "runtime-1",
    threadKey: "thread-1",
    message: "words",
    timeoutMs: 25_000,
}

const USAGE: AgentTurnUsage = { model: "p/m", promptTokens: 4, completionTokens: 2, cost: 0.1, durationMs: 800 }

const WAKE_REF = { agentId: "agent-1", wakeId: "wake-1" }

/** What the drain hands `finish`: the ending it names, with no error code and no usage unless it says so. */
const finished = <Fields extends object>(fields: Fields) => ({ errorCode: null, usage: null, ...fields })

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
    const outbox = jobRecordingOutbox()
    const real = new AgentTurnQueue(outbox)
    const queue = mock<AgentTurnQueue>({
        enqueueNextDrain: jest.fn(real.enqueueNextDrain.bind(real)),
        enqueueDrain: jest.fn(real.enqueueDrain.bind(real)),
    })
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
            { provide: AgentWakeInterruptionService, useValue: mock<AgentWakeInterruptionService>() },
        ],
    }).compile()
    const service = container.get(AgentDrainService)
    return { service, turns, handler: registered, handlers, executor: runner, queue, outbox, endedWakes, logger, tx }
}

type Fixture = Awaited<ReturnType<typeof build>>

describe("AgentDrainService.drain, a wake its agent's graph runs", () => {
    it("lets the flow run a wake it takes, with no handler and no model turn", async () => {
        const { service, turns, handler, handlers, executor } = await build()
        const flow = mock<AgentWorkFlow>({
            takes: jest.fn().mockResolvedValue(true),
            run: jest.fn().mockResolvedValue({ status: "done", reason: null, outcome: { ran: "graph" } }),
        })
        handlers.flowOf.mockReturnValue(flow)

        await service.drain(PAYLOAD)

        expect(flow.run).toHaveBeenCalledWith(turn(), expect.any(AbortSignal))
        expect(handler.prepare).not.toHaveBeenCalled()
        expect(executor.run).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            finished({ status: "done", reason: null, outcome: { ran: "graph" } }),
        )
    })

    it("gives up a wake of the flow through the flow, never through a handler: no hold-over, no reply item, the wake fails", async () => {
        const { service, turns, handler, handlers } = await build()
        const last = turn({ attempts: 3, maxAttempts: 3 })
        turns.begin.mockResolvedValue({ result: "begun", turn: last, ended: [] })
        const flow = mock<AgentWorkFlow>({
            takes: jest.fn().mockResolvedValue(true),
            run: jest.fn().mockRejectedValue(new Error("routing failed")),
            stuck: jest.fn().mockResolvedValue(undefined),
        })
        handlers.flowOf.mockReturnValue(flow)

        await service.drain(PAYLOAD)

        expect(flow.stuck).toHaveBeenCalledWith(last, "AGENT_WORK_UNEXPECTED")
        expect(handler.holdOver).not.toHaveBeenCalled()
        expect(handler.prepare).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(
            last,
            expect.objectContaining({ status: "failed", errorCode: "AGENT_WORK_UNEXPECTED" }),
        )
    })

    it("tells nobody while a failed wake of the flow still has tries left", async () => {
        const { service, handler, handlers } = await build()
        const flow = mock<AgentWorkFlow>({
            takes: jest.fn().mockResolvedValue(true),
            run: jest.fn().mockRejectedValue(new Error("routing failed")),
            stuck: jest.fn().mockResolvedValue(undefined),
        })
        handlers.flowOf.mockReturnValue(flow)

        await service.drain(PAYLOAD)

        expect(flow.stuck).not.toHaveBeenCalled()
        expect(handler.holdOver).not.toHaveBeenCalled()
    })

    it("leaves a wake the flow does not take to the handler of its source", async () => {
        const { service, handler, handlers } = await build()
        const flow = mock<AgentWorkFlow>({ takes: jest.fn().mockResolvedValue(false) })
        handlers.flowOf.mockReturnValue(flow)

        await service.drain(PAYLOAD)

        expect(flow.run).not.toHaveBeenCalled()
        expect(handler.prepare).toHaveBeenCalled()
    })
})

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
        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            finished({ status: "done", reason: null, outcome: { sent: true }, usage: USAGE }),
        )
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
        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            finished({ status: "skipped", reason: "no_work", outcome: null }),
        )
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

describe("AgentDrainService.drain, a drain that came before the burst window ended", () => {
    const WAIT = { ms: 1100, wakeId: "wake-9" }

    it("schedules one follow-up drain for the time the database says is left, in a transaction, and runs nothing", async () => {
        const { service, turns, handler, outbox, logger } = await build()
        turns.begin.mockResolvedValue({ result: "idle", ended: [], wait: WAIT })

        await service.drain(PAYLOAD)

        expect(outbox.written).toEqual([
            {
                queue: "agent_turn",
                payload: { ...PAYLOAD, rearm: 1 },
                job: "agent-turn.drain",
                dedupeKey: "agent-turn:agent-1:rearm:conversation:conv-1:wake-9:1",
                delayMs: 1100,
            },
        ])
        expect(outbox.inTransaction).toBe(true)
        expect(handler.prepare).not.toHaveBeenCalled()
        expect(turns.finish).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(AgentWorkLogEvent.DrainRearmed, {
            agentId: "agent-1",
            scopeKey: "conversation:conv-1",
            wakeId: "wake-9",
            hop: 1,
            waitMs: 1100,
        })
    })

    it("asks for the same follow-up from every drain that waits for the same message, and for the next hop from a follow-up that came early", async () => {
        const { service, turns, outbox } = await build()
        turns.begin.mockResolvedValue({ result: "idle", ended: [], wait: WAIT })

        await service.drain(PAYLOAD)
        await service.drain(PAYLOAD)
        await service.drain({ ...PAYLOAD, rearm: 1 } as typeof PAYLOAD)

        expect(outbox.written.map((job) => job.dedupeKey)).toEqual([
            "agent-turn:agent-1:rearm:conversation:conv-1:wake-9:1",
            "agent-turn:agent-1:rearm:conversation:conv-1:wake-9:1",
            "agent-turn:agent-1:rearm:conversation:conv-1:wake-9:2",
        ])
        expect(outbox.written[2]?.payload).toEqual({ ...PAYLOAD, rearm: 2 })
    })

    it("never schedules a follow-up that comes back at once: a wait of a few milliseconds waits the floor", async () => {
        const { service, turns, outbox } = await build()
        turns.begin.mockResolvedValue({ result: "idle", ended: [], wait: { ms: 3, wakeId: "wake-9" } })

        await service.drain(PAYLOAD)

        expect(outbox.written[0]?.delayMs).toBe(250)
    })

    it("stops after the last hop and leaves the wake to the minute sweep, so no chain of jobs lives on a clock that never settles", async () => {
        const { service, turns, outbox, logger } = await build()
        turns.begin.mockResolvedValue({ result: "idle", ended: [], wait: WAIT })

        await service.drain({ ...PAYLOAD, rearm: 5 } as typeof PAYLOAD)

        expect(outbox.written).toEqual([])
        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.DrainRearmSpent, expect.objectContaining({ hop: 6 }))
    })

    it("schedules nothing for an idle scope that tells no wait", async () => {
        const { service, turns, outbox } = await build()
        turns.begin.mockResolvedValue({ result: "idle", ended: [] })

        await service.drain(PAYLOAD)

        expect(outbox.written).toEqual([])
    })
})

/**
 * A conversation under two clocks. The host's clock times the broker: a job comes `delayMs` host milliseconds after it was written.
 * The database's clock stamps the wakes and judges the window, and reads the host's clock plus an offset that may change while a
 * drain waits. The gate is the rule of `agent_turn_begin`: wait while the newest pending wake is inside the window (less half a
 * second) and the oldest inside the longest wait, telling how long is left; else take the oldest wake and merge the others.
 */
const WINDOW_MS = 6000
const MAX_MS = 20_000

interface Wake {
    readonly id: string
    readonly createdAt: number
    status: "pending" | "running" | "skipped"
}

const underTwoClocks = async (messagesAt: ReadonlyArray<number>, offsetAt: (hostMs: number) => number) => {
    const fixture = await build()
    let host = 0
    const database = () => host + offsetAt(host)
    const wakes: Array<Wake> = []
    const begun: Array<{ readonly hostMs: number; readonly wakeId: string; readonly merged: ReadonlyArray<string> }> = []
    const jobs: Array<{ readonly at: number; readonly payload: typeof PAYLOAD }> = []
    const keys = new Set<string>()
    let read = 0
    fixture.turns.begin.mockImplementation(() => {
        const pending = wakes.filter((wake) => wake.status === "pending")
        const [oldest] = pending
        const newest = pending.at(-1)
        if (oldest === undefined || newest === undefined) return Promise.resolve({ result: "idle", ended: [] })
        const open = Math.min(newest.createdAt + WINDOW_MS - 500, oldest.createdAt + MAX_MS)
        if (open > database()) {
            return Promise.resolve({ result: "idle", ended: [], wait: { ms: Math.ceil(open - database()), wakeId: newest.id } })
        }
        for (const wake of pending) wake.status = wake === oldest ? "running" : "skipped"
        begun.push({ hostMs: host, wakeId: oldest.id, merged: pending.slice(1).map((wake) => wake.id) })
        return Promise.resolve({ result: "begun", turn: turn({ wakeId: oldest.id }), ended: [] })
    })
    /** The jobs the drain wrote since the last look, each once per dedupe key, due `delayMs` host milliseconds from now. */
    const collect = () => {
        for (const job of fixture.outbox.written.slice(read)) {
            const key = job.dedupeKey ?? ""
            if (keys.has(key)) continue
            keys.add(key)
            jobs.push({ at: host + (job.delayMs ?? 0), payload: job.payload as typeof PAYLOAD })
        }
        read = fixture.outbox.written.length
    }
    // Each message writes its wake (stamped by the database) and its own drain, one window ahead.
    const arrivals = messagesAt.map((at, index) => ({ at, id: `wake-${String(index + 1)}` }))
    const next = (): { readonly at: number; readonly run: () => Promise<void> } | undefined => {
        const arrival = arrivals[0]
        const job = jobs.toSorted((a, b) => a.at - b.at)[0]
        if (arrival !== undefined && (job === undefined || arrival.at <= job.at)) {
            return {
                at: arrival.at,
                run: () => {
                    arrivals.shift()
                    wakes.push({ id: arrival.id, createdAt: database(), status: "pending" })
                    jobs.push({ at: host + WINDOW_MS, payload: PAYLOAD })
                    return Promise.resolve()
                },
            }
        }
        if (job === undefined) return undefined
        return {
            at: job.at,
            run: async () => {
                jobs.splice(jobs.indexOf(job), 1)
                await fixture.service.drain(job.payload)
                collect()
            },
        }
    }
    let drains = 0
    for (let event = next(); event !== undefined; event = next()) {
        host = event.at
        await event.run()
        drains += 1
    }
    return { begun, wakes, followUps: keys.size, events: drains, endedAt: host }
}

/** The database clock falls `ms` behind the host's one second after the first message (the host is then that far ahead). */
const fallsBehind = (ms: number) => (hostMs: number) => (hostMs >= 1000 ? -ms : 0)

describe("AgentDrainService.drain, a conversation whose database and host clocks disagree", () => {
    it.each([
        { ahead: 1500, startsBy: 7000 },
        { ahead: 5000, startsBy: 10_500 },
    ])("starts a lone message after the window and one follow-up when the host runs $ahead ms ahead", async ({ ahead, startsBy }) => {
        const { begun, followUps, endedAt } = await underTwoClocks([0], fallsBehind(ahead))

        expect(begun).toEqual([{ hostMs: startsBy, wakeId: "wake-1", merged: [] }])
        expect(followUps).toBe(1)
        // Nothing is left for the minute sweep, and no job outlives the turn.
        expect(endedAt).toBe(startsBy)
    })

    it("starts a lone message at its own drain, with no follow-up, when the host runs 1500 ms behind or the clocks only differ by a constant", async () => {
        const behind = await underTwoClocks([0], (hostMs) => (hostMs >= 1000 ? 1500 : 0))
        const constant = await underTwoClocks([0], () => -1500)

        for (const run of [behind, constant]) {
            expect(run.begun).toEqual([{ hostMs: WINDOW_MS, wakeId: "wake-1", merged: [] }])
            expect(run.followUps).toBe(0)
        }
    })

    it.each([
        { name: "the host 1500 ms ahead", offset: (hostMs: number) => (hostMs >= 5000 ? -1500 : 0), startsAt: 11_000, followUps: 1 },
        { name: "the host 5000 ms ahead", offset: (hostMs: number) => (hostMs >= 5000 ? -5000 : 0), startsAt: 14_500, followUps: 1 },
        { name: "the host 1500 ms behind", offset: (hostMs: number) => (hostMs >= 5000 ? 1500 : 0), startsAt: 8000, followUps: 1 },
    ])("still makes one turn of a burst of three messages with $name, and runs no wake twice", async ({ offset, startsAt, followUps }) => {
        const run = await underTwoClocks([0, 2000, 4000], offset)

        expect(run.begun).toEqual([{ hostMs: startsAt, wakeId: "wake-1", merged: ["wake-2", "wake-3"] }])
        expect(run.wakes.map((wake) => wake.status)).toEqual(["running", "skipped", "skipped"])
        // The three drains that waited for the last message asked for one follow-up between them.
        expect(run.followUps).toBe(followUps)
    })

    it("follows a clock that is stepped back twice with two follow-ups, one after the other, and still one turn", async () => {
        const { begun, followUps } = await underTwoClocks([0], (hostMs) => (hostMs >= 6500 ? -3000 : hostMs >= 1000 ? -1500 : 0))

        expect(begun).toEqual([{ hostMs: 8500, wakeId: "wake-1", merged: [] }])
        expect(followUps).toBe(2)
    })
})

describe("AgentDrainService.drain, a turn that cannot be settled", () => {
    it("lets the handler answer when no turn can run, and stores no proposal", async () => {
        const { service, turns, handler, executor } = await build()
        executor.run.mockResolvedValue({ kind: "blocked", reason: "quota" })

        await service.drain(PAYLOAD)

        expect(handler.holdOver).toHaveBeenCalledWith(turn(), "quota")
        expect(turns.propose).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            finished({ status: "done", reason: "holding_line", outcome: null }),
        )
    })

    it("stops before settling when the lease moved on while the model ran", async () => {
        const { service, turns, handler, logger } = await build()
        turns.propose.mockResolvedValue("fenced")

        await service.drain(PAYLOAD)

        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFenced, WAKE_REF)
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

        expect(logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFailed, cause, WAKE_REF)
        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            finished({ status: "failed", reason: "error", outcome: null, errorCode: AgentWorkErrorCode.AgentNotFound }),
        )
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

    it("starts the next drain in a transaction when another wake of the scope is due", async () => {
        const { service, turns, outbox } = await build()
        turns.finish.mockResolvedValue({ fenced: false, more: true })

        await service.drain(PAYLOAD)

        expect(outbox.written).toEqual([
            {
                queue: "agent_turn",
                payload: PAYLOAD,
                job: "agent-turn.drain",
                dedupeKey: "agent-turn:agent-1:next:turn-1",
            },
        ])
        expect(outbox.inTransaction).toBe(true)
    })

    it("starts nothing when the lease was lost before the turn ended, even if wakes are due", async () => {
        const { service, turns, queue, logger } = await build()
        turns.finish.mockResolvedValue({ fenced: true, more: true })

        await service.drain(PAYLOAD)

        expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFenced, WAKE_REF)
        expect(queue.enqueueNextDrain).not.toHaveBeenCalled()
    })
})

describe("AgentDrainService.drain, a runtime that is down", () => {
    it("gives a customer the holding line at once when the runtime is down, ends the wake and still counts the failure", async () => {
        const { service, turns, executor, handler } = await build()
        executor.run.mockRejectedValue(new Error("socket closed"))

        await service.drain(PAYLOAD)

        expect(handler.holdOver).toHaveBeenCalledWith(turn(), "error")
        expect(turns.propose).not.toHaveBeenCalled()
        expect(turns.finish).toHaveBeenCalledWith(
            turn(),
            finished({ status: "done", reason: "holding_line", outcome: null, errorCode: "AGENT_WORK_UNEXPECTED" }),
        )
    })

    it.each(["tag", "internal", "schedule"] as const)(
        "gives up a %s wake on its last attempt: it is announced once through the handler and fails",
        async (source) => {
            const { service, turns, executor, handler, logger } = await build()
            const last = turn({ source, attempts: 3, maxAttempts: 3 })
            turns.begin.mockResolvedValue({ result: "begun", turn: last, ended: [] })
            executor.run.mockRejectedValue(new Error("socket closed"))

            await service.drain(PAYLOAD)

            expect(logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.WakeDead, WAKE_REF)
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

        expect(logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.TurnFailed, cause, WAKE_REF)
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

/** Runs the specs of the enclosing block on fake timers. */
const fakeTimers = () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())
}

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

describe("AgentDrainService.drain, the heartbeat and its budget", () => {
    fakeTimers()

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

    it("keeps the lease of a workflow wake whose model call and its one retry take ninety seconds: the lease never lapses under it", async () => {
        const fixture = await build()
        const gate = new AbortController()
        const flow = mock<AgentWorkFlow>({
            takes: jest.fn().mockResolvedValue(true),
            run: jest.fn(async () => {
                await whenAborted(gate.signal)
                return { status: "done" as const, reason: null, outcome: { ran: "graph" } }
            }),
        })
        fixture.handlers.flowOf.mockReturnValue(flow)

        const done = fixture.service.drain(PAYLOAD)
        // A model call that times out (45 s) and its one retry (45 s): the lease is 90 s and each beat pushes it 90 s further.
        await jest.advanceTimersByTimeAsync(LEASE_SECONDS * 1000)
        expect(fixture.turns.touch).toHaveBeenCalledTimes(Math.floor((LEASE_SECONDS * 1000) / HEARTBEAT_MS))
        expect(HEARTBEAT_MS * 2).toBeLessThan(LEASE_SECONDS * 1000)
        expect((flow.run.mock.calls[0]?.[1] as AbortSignal).aborted).toBe(false)

        gate.abort()
        await done
        expect(fixture.turns.finish).toHaveBeenCalledWith(turn(), expect.objectContaining({ status: "done" }))
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

        expect(fixture.logger.error).toHaveBeenCalledWith(AgentWorkLogEvent.HeartbeatFailed, cause, WAKE_REF)
        expect(fixture.turns.touch).toHaveBeenCalledTimes(2)
        expect(seen.signal?.aborted).toBe(false)
        release()
        await done
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
        expect(fixture.logger.warn).toHaveBeenCalledWith(AgentWorkLogEvent.TurnOverran, WAKE_REF)
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
