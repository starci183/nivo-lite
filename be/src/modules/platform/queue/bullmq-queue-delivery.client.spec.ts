import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager, MockOf } from "@starci/jest-preset"
import { DelayedError, UnrecoverableError } from "bullmq"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ERROR_REPORTER } from "@modules/platform/errors"
import type { ErrorReporter } from "@modules/platform/errors"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BullmqQueueDeliveryClient } from "./bullmq-queue-delivery.client"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueDelivery, QueueHandler } from "./queue.contracts"
import { QUEUE_OPTIONS } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { deferMsOf } from "./queue.policy"
import type { BullmqJob, QueueRedisGuard } from "./queue-transport.port"
import type { QueueStartRow } from "./persistence/queue.rows"

const RUN_TOKEN = "76f0baf0-1815-4b96-b487-68e0bb4e7042"

const options: QueueOptions = {
    enabled: true,
    redisHost: "redis.invalid",
    redisPort: 6380,
    redisDb: 3,
    prefix: "proof",
    concurrency: 2,
    workspaceConcurrency: 2,
    relayIntervalMs: 50,
    relayBatch: 50,
    reconcileAfterMs: 15_000,
    visibilityTimeoutMs: 30_000,
    shutdownGraceMs: 10,
    schedulers: [],
}

/** The durable answer of the admission statement: a started delivery of the given attempt. */
const started = (attempt = 1): Array<QueueStartRow> => [
    { outcome: "started", attempt, state: "running", run_token: RUN_TOKEN },
]

/** The durable answer for a delivery that was not admitted. */
const refused = (outcome: "busy" | "terminal" | "missing", state: string): Array<QueueStartRow> => [
    { outcome, attempt: 0, state, run_token: null },
]

const brokerJob = (job: Partial<BullmqJob> = {}): MockOf<BullmqJob> =>
    mock<BullmqJob>({ id: "row-1", name: "knowledge.index", data: {}, attemptsMade: 0, ...job })

const handlerOf = (extra: Partial<QueueHandler> = {}): MockOf<QueueHandler> => {
    const handler = mock<QueueHandler>({ queue: "knowledge", job: "knowledge.index", ...extra })
    if (extra.handle === undefined) handler.handle.mockResolvedValue(undefined)
    return handler
}

const ran = (em: MockEntityManager, statement: string): boolean =>
    em.query.mock.calls.some(([sql]) => String(sql).includes(statement))

const paramsOf = (em: MockEntityManager, statement: string): unknown =>
    em.query.mock.calls.find(([sql]) => String(sql).includes(statement))?.[1]

/** A promise a spec settles by hand. */
interface Gate {
    promise: Promise<void>
    resolve: () => void
    reject: (cause: unknown) => void
}

interface GateControls {
    resolve: () => void
    reject: (cause: unknown) => void
}

const gate = (): Gate => {
    const state: GateControls = {
        resolve: () => undefined,
        reject: () => undefined,
    }
    const promise = new Promise<void>((yes, no) => {
        state.resolve = yes
        state.reject = no
    })
    return { promise, resolve: () => state.resolve(), reject: (cause: unknown) => state.reject(cause) }
}

const build = async (answer: Array<QueueStartRow> = started(), withReporter = true) => {
    const em = mockEntityManager()
    em.query.mockImplementation((sql: unknown) => Promise.resolve(String(sql).includes("job_start") ? answer : []))
    const logger = mock<Logger>()
    const reporter = mock<ErrorReporter>()
    const redis = mock<QueueRedisGuard>()
    redis.ready.mockResolvedValue(undefined)
    redis.command.mockImplementation((promise) => promise)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BullmqQueueDeliveryClient,
            { provide: QUEUE_OPTIONS, useValue: options },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(1_000_000) },
            ...(withReporter ? [{ provide: ERROR_REPORTER, useValue: reporter }] : []),
        ],
    }).compile()
    return { client: moduleRef.get(BullmqQueueDeliveryClient), em, logger, reporter, redis }
}

afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
})

describe("admission", () => {
    it("admits a delivery, runs its handler and closes the row done under the admission token", async () => {
        const { client, em, redis } = await build(started(2))
        const handler = handlerOf()

        await client.deliver(handler, brokerJob({ data: { sourceId: "s-1" } }), "token", redis)

        const delivery = handler.handle.mock.calls[0]?.[0]
        expect(delivery?.signal).toBeInstanceOf(AbortSignal)
        expect({
            id: delivery?.id,
            queue: delivery?.queue,
            payload: delivery?.payload,
            attempt: delivery?.attempt,
        }).toEqual({ id: "row-1", queue: "knowledge", payload: { sourceId: "s-1" }, attempt: 2 })
        expect(redis.ready).toHaveBeenCalledWith("knowledge")
        expect(paramsOf(em, "job_done")).toEqual(["row-1", RUN_TOKEN])
    })

    it("moves a job the workspace limit refuses back to delayed and never runs it", async () => {
        const { client, redis } = await build(refused("busy", "queued"))
        const handler = handlerOf()
        const job = brokerJob()

        await expect(client.deliver(handler, job, "token", redis)).rejects.toBeInstanceOf(DelayedError)

        expect(handler.handle).not.toHaveBeenCalled()
        expect(job.moveToDelayed).toHaveBeenCalledWith(1_000_000 + deferMsOf("row-1"), "token")
    })

    it("ends a delivery of a row the record says is done without running it", async () => {
        const { client, redis } = await build(refused("terminal", "done"))
        const handler = handlerOf()

        await expect(client.deliver(handler, brokerJob(), "token", redis)).resolves.toBeUndefined()

        expect(handler.handle).not.toHaveBeenCalled()
    })
})

describe("admission refusals", () => {
    it("fails a terminal failed row instead of recording broker completion", async () => {
        const { client, redis } = await build(refused("terminal", "failed"))
        const handler = handlerOf()

        await expect(client.deliver(handler, brokerJob(), "token", redis)).rejects.toBeInstanceOf(UnrecoverableError)

        expect(handler.handle).not.toHaveBeenCalled()
    })

    it("refuses missing durable admissions and broker deliveries without an identity", async () => {
        const { client, em, logger, redis } = await build([])
        const handler = handlerOf()
        const deliver = (job: BullmqJob) => client.deliver(handler, job, undefined, redis)
        await expect(deliver(brokerJob())).rejects.toBeInstanceOf(UnrecoverableError)
        em.query.mockResolvedValue(refused("missing", ""))
        await expect(deliver(brokerJob())).rejects.toBeInstanceOf(UnrecoverableError)
        await expect(deliver(brokerJob({ id: undefined }))).rejects.toBeInstanceOf(UnrecoverableError)
        expect(logger.warn).toHaveBeenCalledWith(QueueLogEvent.SettleFailed, {
            queue: "knowledge",
            job: "knowledge.index",
        })
        expect(handler.handle).not.toHaveBeenCalled()
    })

    it("renews only the admitted attempt and clears the heartbeat after success or a renewal error", async () => {
        jest.useFakeTimers()
        const { client, em, logger, redis } = await build()
        const finish = gate()
        const began = gate()
        const handler = handlerOf({
            handle: () => {
                began.resolve()
                return finish.promise
            },
        })
        const cause = new Error("lease database unavailable")
        const leases = () => em.query.mock.calls.filter(([sql]) => String(sql).includes("job_lease"))
        em.query.mockImplementation((sql: unknown) => {
            if (String(sql).includes("job_start")) return Promise.resolve(started(3))
            return String(sql).includes("job_lease") && leases().length === 2
                ? Promise.reject(cause)
                : Promise.resolve([])
        })
        const running = client.deliver(handler, brokerJob(), undefined, redis)
        await began.promise
        await jest.advanceTimersByTimeAsync(20_000)
        expect(leases().map(([, params]) => params)).toEqual([
            ["row-1", 30, RUN_TOKEN],
            ["row-1", 30, RUN_TOKEN],
        ])
        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.TouchFailed, cause, {
            queue: "knowledge",
            jobId: "row-1",
        })
        finish.resolve()
        await running
        expect(jest.getTimerCount()).toBe(0)
    })
})

describe("failures", () => {
    it("retries a failed delivery on the durable row and lets the broker keep the pause", async () => {
        const { client, em, redis } = await build()
        const failure = new Error("provider down")
        const handler = handlerOf({ handle: jest.fn(() => Promise.reject(failure)) })

        await expect(client.deliver(handler, brokerJob(), "token", redis)).rejects.toBe(failure)

        expect(ran(em, "job_retry")).toBe(true)
        expect(ran(em, "job_dead")).toBe(false)
    })

    it("dead-letters a delivery that may not run again: failure hook once, the row failed, no broker retry", async () => {
        const { client, em, reporter, redis } = await build()
        const cause = new QueueError({ code: QueueErrorCode.Unrecoverable, params: { reason: "blocked" } })
        const failed = jest.fn((_delivery: QueueDelivery, _cause: unknown) => Promise.resolve())
        const handler = handlerOf({ handle: jest.fn(() => Promise.reject(cause)), failed })

        await expect(client.deliver(handler, brokerJob(), "token", redis)).rejects.toBeInstanceOf(UnrecoverableError)

        expect(failed).toHaveBeenCalledTimes(1)
        expect(reporter.report).toHaveBeenCalledWith("job.knowledge", cause, {
            workspaceId: null,
            job: "knowledge.index",
            attempt: 1,
        })
        expect(ran(em, "job_dead")).toBe(true)
    })

    it("treats a synchronous handler throw as a real failure and always clears its heartbeat", async () => {
        jest.useFakeTimers()
        const { client, em, redis } = await build()
        const cause = new QueueError({ code: QueueErrorCode.RetryAfter, params: { seconds: 5 } })
        const handler = handlerOf({
            handle: () => {
                throw cause
            },
        })

        await expect(client.deliver(handler, brokerJob(), undefined, redis)).rejects.toBe(cause)

        expect(jest.getTimerCount()).toBe(0)
        expect(ran(em, "job_retry")).toBe(true)
        expect(ran(em, "job_done")).toBe(false)
    })
})

describe("failure settlement", () => {
    it("preserves a failed settlement as failure and re-runs the recovered attempt", async () => {
        const { client, em, logger, redis } = await build()
        const databaseFailure = new Error("settle unavailable")
        const handler = handlerOf({
            handle: jest.fn().mockRejectedValueOnce(new Error("provider unavailable")).mockResolvedValue(undefined),
        })
        em.query.mockImplementation((sql: unknown) => {
            if (String(sql).includes("job_start")) return Promise.resolve(started(2))
            return String(sql).includes("job_retry") ? Promise.reject(databaseFailure) : Promise.resolve([])
        })

        await expect(client.deliver(handler, brokerJob(), undefined, redis)).rejects.toBe(databaseFailure)
        expect(ran(em, "job_done")).toBe(false)
        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.SettleFailed, databaseFailure, {
            queue: "knowledge",
            jobId: "row-1",
        })
        await client.deliver(handler, brokerJob(), undefined, redis)

        expect(handler.handle).toHaveBeenCalledTimes(2)
        expect(paramsOf(em, "job_done")).toEqual(["row-1", RUN_TOKEN])
    })

    it("propagates completion persistence failures without a successful delivery", async () => {
        const { client, em, logger, redis } = await build()
        const cause = new Error("completion unavailable")
        em.query.mockImplementation((sql: unknown) =>
            String(sql).includes("job_start") ? Promise.resolve(started()) : Promise.reject(cause),
        )

        await expect(client.deliver(handlerOf(), brokerJob(), undefined, redis)).rejects.toBe(cause)

        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.SettleFailed, cause, {
            queue: "knowledge",
            jobId: "row-1",
        })
    })

    it("defers a live fenced claim without exhausting either retry budget", async () => {
        const { client, em, redis } = await build()
        const cause = new QueueError({ code: QueueErrorCode.DeferredUntil, params: { seconds: 27 } })
        const job = brokerJob()
        const handler = handlerOf({ handle: () => Promise.reject(cause) })

        await expect(client.deliver(handler, job, "token", redis)).rejects.toBeInstanceOf(DelayedError)

        expect(job.moveToDelayed).toHaveBeenCalledWith(1_027_000, "token")
        expect(paramsOf(em, "job_handback")).toEqual(["row-1", RUN_TOKEN])
        expect(ran(em, "job_retry") || ran(em, "job_dead")).toBe(false)
    })
})

describe("failure dead letters", () => {
    it("exhausts the durable attempt budget without requiring a failure hook or reporter", async () => {
        const { client, em, redis } = await build(started(4), false)
        const handler: QueueHandler = {
            queue: "knowledge",
            job: "index",
            handle: () => Promise.reject(new Error("provider unavailable")),
        }

        await expect(client.deliver(handler, brokerJob(), undefined, redis)).rejects.toBeInstanceOf(UnrecoverableError)

        expect(paramsOf(em, "job_dead")).toEqual(["row-1", "provider unavailable", RUN_TOKEN])
    })

    it("logs a failed failure hook and still persists the durable dead letter", async () => {
        const { client, em, logger, redis } = await build()
        const hookFailure = new Error("owner failure write unavailable")
        const handler = handlerOf({
            handle: () => Promise.reject(new QueueError({ code: QueueErrorCode.Unrecoverable })),
            failed: () => Promise.reject(hookFailure),
        })

        await expect(client.deliver(handler, brokerJob(), undefined, redis)).rejects.toBeInstanceOf(UnrecoverableError)

        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.FailureHookFailed, hookFailure, {
            queue: "knowledge",
            job: "knowledge.index",
        })
        expect(ran(em, "job_dead")).toBe(true)
    })
})

describe("shutdown", () => {
    it("hands an aborted delivery back without spending an attempt", async () => {
        const { client, em, redis } = await build()
        const began = gate()
        const handler = handlerOf({
            handle: (delivery) =>
                new Promise<void>((_resolve, reject) => {
                    began.resolve()
                    delivery.signal.addEventListener("abort", () => reject(new Error("aborted")))
                }),
        })
        const job = brokerJob()
        const running = client.deliver(handler, job, "token", redis).catch((cause: unknown) => cause)
        await began.promise

        client.abortAll()

        expect(await running).toBeInstanceOf(DelayedError)
        expect(paramsOf(em, "job_handback")).toEqual(["row-1", RUN_TOKEN])
        expect(job.moveToDelayed).toHaveBeenCalledWith(1_000_000 + deferMsOf("row-1"), "token")
        await expect(client.settled()).resolves.toBeUndefined()
    })

    it("waits for a delivery in flight and counts its real failure instead of handing it back", async () => {
        const { client, em, redis } = await build()
        const finish = gate()
        const began = gate()
        const handler = handlerOf({
            handle: () => {
                began.resolve()
                return finish.promise
            },
        })
        const running = expect(client.deliver(handler, brokerJob(), undefined, redis)).rejects.toThrow(
            "provider failure",
        )
        await began.promise
        let settled = false
        const waiting = client.settled().then(() => {
            settled = true
        })
        await Promise.resolve()
        expect(settled).toBe(false)

        finish.reject(new Error("provider failure"))
        await running
        await waiting

        expect(settled).toBe(true)
        expect(ran(em, "job_retry")).toBe(true)
        expect(ran(em, "job_handback")).toBe(false)
    })

    it("defers late deliveries before admission once stopped", async () => {
        const { client, em, redis } = await build()
        const handler = handlerOf()
        const job = brokerJob()
        const anonymous = brokerJob({ id: undefined })

        client.stop()

        await expect(client.deliver(handler, job, "token", redis)).rejects.toBeInstanceOf(DelayedError)
        await expect(client.deliver(handler, anonymous, "token", redis)).rejects.toBeInstanceOf(DelayedError)
        expect(job.moveToDelayed).toHaveBeenCalledWith(1_000_000 + deferMsOf("row-1"), "token")
        expect(anonymous.moveToDelayed).toHaveBeenCalledWith(1_000_000 + deferMsOf("knowledge"), "token")
        expect(em.query).not.toHaveBeenCalled()
        expect(handler.handle).not.toHaveBeenCalled()
    })
})
