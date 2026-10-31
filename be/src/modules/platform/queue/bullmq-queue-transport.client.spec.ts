import { Test } from "@nestjs/testing"
import { UnrecoverableError } from "bullmq"
import { mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import type { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BullmqQueueDeliveryClient } from "./bullmq-queue-delivery.client"
import { BullmqQueueTransportClient } from "./bullmq-queue-transport.client"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueHandler } from "./queue.contracts"
import { QUEUE_FACTORY, QUEUE_OPTIONS } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import type { BullmqJob, BullmqJobOptions, BullmqQueue, BullmqWorker, QueueFactory } from "./queue-transport.port"

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

/** The Redis diagnostics the memory-policy probe reads. */
interface Diagnostics {
    info(section: string): Promise<string>
}

/** What the queue double recorded of one `add`. */
interface RecordedAdd {
    queue: string
    name: string
    payload: object
    options: BullmqJobOptions
}

const brokerJob = (job: Partial<BullmqJob> = {}): MockOf<BullmqJob> =>
    mock<BullmqJob>({ id: "row-1", name: "knowledge.index", data: {}, attemptsMade: 0, ...job })

const handlerOf = (): MockOf<QueueHandler> => mock<QueueHandler>({ queue: "knowledge", job: "knowledge.index" })

interface GateControls {
    resolve: () => void
}

const gate = () => {
    const state: GateControls = { resolve: () => undefined }
    const promise = new Promise<void>((yes) => {
        state.resolve = yes
    })
    return { promise, resolve: () => state.resolve() }
}

const build = async (answers: { options?: Partial<QueueOptions>; clientReady?: Promise<Diagnostics> } = {}) => {
    const adds: Array<RecordedAdd> = []
    const held = new Map<string, MockOf<BullmqJob>>()
    const queues = new Map<string, MockOf<BullmqQueue>>()
    const factory = mock<QueueFactory>()
    const worker = mock<BullmqWorker>()
    worker.pause.mockResolvedValue(undefined)
    worker.close.mockResolvedValue(undefined)
    const diagnostics = mock<Diagnostics>()
    diagnostics.info.mockResolvedValue("maxmemory:268435456\r\nmaxmemory_policy:noeviction\r\n")
    factory.queue.mockImplementation((name: string) => {
        const known = queues.get(name)
        if (known !== undefined) return known
        const queue = mock<BullmqQueue>({
            getBackend: jest.fn(() => ({ client: answers.clientReady ?? Promise.resolve(diagnostics) })),
        })
        queue.add.mockImplementation((job, payload, addOptions) => {
            adds.push({ queue: name, name: job, payload, options: addOptions })
            const key = `${name}:${addOptions.jobId}`
            if (!held.has(key)) held.set(key, brokerJob({ id: addOptions.jobId, name: job, data: payload }))
            return Promise.resolve(held.get(key))
        })
        queue.getJob.mockImplementation((id: string) => Promise.resolve(held.get(`${name}:${id}`)))
        queue.upsertJobScheduler.mockResolvedValue({ timestamp: 1000, delay: 500 })
        queue.getJobScheduler.mockResolvedValue({ next: 123_456 })
        queue.close.mockResolvedValue(undefined)
        queues.set(name, queue)
        return queue
    })
    factory.worker.mockReturnValue(worker)
    const logger = mock<Logger>()
    const delivery = mock<BullmqQueueDeliveryClient>()
    delivery.settled.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BullmqQueueTransportClient,
            { provide: QUEUE_OPTIONS, useValue: { ...options, ...answers.options } },
            { provide: QUEUE_FACTORY, useValue: factory },
            { provide: LOGGER, useValue: logger },
            { provide: BullmqQueueDeliveryClient, useValue: delivery },
        ],
    }).compile()
    return {
        client: moduleRef.get(BullmqQueueTransportClient),
        factory,
        worker,
        queues,
        adds,
        held,
        logger,
        delivery,
        diagnostics,
    }
}

afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
})

describe("add", () => {
    it("adds the job under the outbox row id, with the retry budget and the retention the policy declares", async () => {
        const { client, adds } = await build()

        await client.add("knowledge", "knowledge.index", "row-1", { sourceId: "s-1" })
        await client.add("knowledge", "knowledge.index", "row-1", { sourceId: "s-1" })

        expect(adds).toHaveLength(2)
        expect(adds[0]).toEqual({
            queue: "knowledge",
            name: "knowledge.index",
            payload: { sourceId: "s-1" },
            options: {
                jobId: "row-1",
                attempts: 4,
                backoff: { type: "nivo", delay: 5000 },
                removeOnComplete: { age: 3600 },
                removeOnFail: { age: 604800 },
            },
        })
    })

    it("opens the queue on the Redis of the options, with the prefix and no per-request retries", async () => {
        const { client, factory } = await build()

        await client.add("knowledge", "knowledge.index", "row-1", {})

        expect(factory.queue).toHaveBeenCalledWith("knowledge", {
            prefix: "proof",
            connection: {
                host: "redis.invalid",
                port: 6380,
                db: 3,
                password: undefined,
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
                commandTimeout: 5000,
                connectTimeout: 5000,
            },
        })
    })

    it("validates the memory policy once before accepting work and retries a refused probe", async () => {
        const { client, diagnostics, adds, logger } = await build()
        diagnostics.info.mockResolvedValueOnce("maxmemory:0\r\nmaxmemory_policy:noeviction\r\n")

        await expect(client.add("knowledge", "index", "row-1", {})).rejects.toMatchObject({
            code: QueueErrorCode.RedisConfigurationInvalid,
        })
        expect(adds).toHaveLength(0)
        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.RedisFailed, expect.any(QueueError), {
            queue: "knowledge",
        })
        await client.add("knowledge", "index", "row-1", {})
        await client.add("knowledge", "index", "row-2", {})

        expect(diagnostics.info).toHaveBeenCalledTimes(2)
    })

    it("checks the Redis memory policy again after the broker reconnects", async () => {
        const { client, queues, diagnostics } = await build()
        await client.add("knowledge", "index", "row-1", {})
        queues.get("knowledge")?.on.mock.calls[1]?.[1]()
        diagnostics.info.mockResolvedValueOnce("maxmemory:268435456\r\nmaxmemory_policy:allkeys-lru\r\n")

        await expect(client.add("knowledge", "index", "row-2", {})).rejects.toMatchObject({
            code: QueueErrorCode.RedisConfigurationInvalid,
        })

        expect(diagnostics.info).toHaveBeenCalledTimes(2)
    })
})

describe("add connection", () => {
    it("passes a configured credential only to the driver", async () => {
        const credential = mock<Secret>({ reveal: jest.fn(() => "unit-fixture") })
        const { client, factory } = await build({ options: { redisPassword: credential } })

        await client.add("knowledge", "index", "row-1", {})

        expect(factory.queue.mock.calls[0]?.[1].connection.password).toBe("unit-fixture")
    })

    it("bounds waiting for the first Redis connection before publishing", async () => {
        jest.useFakeTimers()
        const { client, adds } = await build({ clientReady: new Promise<Diagnostics>(() => undefined) })
        const refused = expect(client.add("knowledge", "index", "row-1", {})).rejects.toMatchObject({
            code: QueueErrorCode.RedisDeadline,
        })

        await jest.advanceTimersByTimeAsync(5000)
        await refused

        expect(adds).toHaveLength(0)
        expect(jest.getTimerCount()).toBe(0)
    })
})

describe("stateOf and republish", () => {
    it("answers missing when the broker holds nothing under the id, else the mapped state", async () => {
        const { client, held } = await build()
        held.set("knowledge:row-1", brokerJob({ getState: jest.fn(() => Promise.resolve("delayed")) }))

        expect(await client.stateOf("knowledge", "row-1")).toBe("delayed")
        expect(await client.stateOf("knowledge", "gone")).toBe("missing")
    })

    it("preserves an unknown broker state without assuming completion", async () => {
        const { client, held } = await build()
        held.set("knowledge:row-1", brokerJob({ getState: jest.fn(() => Promise.resolve("future-state")) }))

        expect(await client.stateOf("knowledge", "row-1")).toBe("unknown")
    })

    it("drops the failed job the broker holds and adds it again under the same id", async () => {
        const { client, held, adds } = await build()
        const job = brokerJob({ id: "row-1", getState: jest.fn(() => Promise.resolve("failed")) })
        held.set("knowledge:row-1", job)

        await client.republish("knowledge", "knowledge.index", "row-1", { sourceId: "s-1" })

        expect(job.remove).toHaveBeenCalledTimes(1)
        expect(adds).toHaveLength(1)
        expect(adds[0]?.options.jobId).toBe("row-1")
    })

    it("recreates a completed or absent copy and leaves live broker deliveries untouched", async () => {
        const { client, held, adds } = await build()
        const completed = brokerJob({ getState: jest.fn(() => Promise.resolve("completed")) })
        const active = brokerJob({ getState: jest.fn(() => Promise.resolve("active")) })
        held.set("knowledge:done", completed)
        held.set("knowledge:active", active)

        await client.republish("knowledge", "index", "done", {})
        await client.republish("knowledge", "index", "missing", {})
        await client.republish("knowledge", "index", "active", {})

        expect(completed.remove).toHaveBeenCalledTimes(1)
        expect(active.remove).not.toHaveBeenCalled()
        expect(adds.map((added) => added.options.jobId)).toEqual(["done", "missing"])
    })
})

describe("work", () => {
    it("starts the worker of the queue on the shared connection, its concurrency and the lock the lease mirrors", async () => {
        const { client, factory } = await build()

        await client.work(handlerOf(), 5)

        const workerOptions = factory.worker.mock.calls[0]?.[2]
        expect(workerOptions?.prefix).toBe("proof")
        expect(workerOptions?.connection).toEqual({
            host: "redis.invalid",
            port: 6380,
            db: 3,
            password: undefined,
            maxRetriesPerRequest: null,
            connectTimeout: 5000,
        })
        expect(workerOptions?.concurrency).toBe(5)
        expect(workerOptions?.lockDuration).toBe(30_000)
        expect(workerOptions?.backoffStrategy(2)).toBe(10_000)
    })

    it("hands every job of the worker to the delivery client with the bounded Redis guard", async () => {
        const { client, factory, delivery, diagnostics } = await build()
        const handler = handlerOf()
        const job = brokerJob()
        delivery.deliver.mockResolvedValue(undefined)
        await client.work(handler, 1)

        await factory.worker.mock.calls[0]?.[1](job, "token")

        const guard = delivery.deliver.mock.calls[0]?.[3]
        expect(delivery.deliver).toHaveBeenCalledWith(handler, job, "token", guard)
        await expect(guard?.ready("knowledge")).resolves.toBeUndefined()
        await expect(guard?.command(Promise.resolve(7))).resolves.toBe(7)
        expect(diagnostics.info).toHaveBeenCalledTimes(1)
    })

    it("routes asynchronous queue and worker failures through the logger", async () => {
        const { client, worker, queues, logger } = await build()
        await client.work(handlerOf(), 1)
        const cause = new Error("local Redis unavailable")

        queues.get("knowledge")?.on.mock.calls[0]?.[1](cause)
        worker.on.mock.calls[0]?.[1](cause)

        expect(logger.error).toHaveBeenCalledTimes(2)
        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.RedisFailed, cause, { queue: "knowledge" })
    })

    it("waits for the requested polling duration", async () => {
        jest.useFakeTimers()
        const { client } = await build()
        let finished = false
        const waited = client.wait(45).then(() => {
            finished = true
        })

        await jest.advanceTimersByTimeAsync(44)
        expect(finished).toBe(false)
        await jest.advanceTimersByTimeAsync(1)
        await waited

        expect(finished).toBe(true)
    })
})

describe("schedule, unschedule and nextOf", () => {
    it("forwards the pattern, the zone and the retry template, and answers the next slot the broker holds", async () => {
        const { client, queues } = await build()

        const next = await client.schedule("fires", "agent-trigger:t-1", { pattern: "7 8 * * *", tz: "UTC" }, "fire", {})

        expect(next).toEqual(new Date(1500))
        expect(queues.get("fires")?.upsertJobScheduler).toHaveBeenCalledWith(
            "agent-trigger:t-1",
            { pattern: "7 8 * * *", tz: "UTC" },
            {
                name: "fire",
                data: {},
                opts: {
                    attempts: 3,
                    backoff: { type: "nivo", delay: 5000 },
                    removeOnComplete: { age: 3600 },
                    removeOnFail: { age: 604800 },
                },
            },
        )
    })

    it("removes a scheduler by id and reads the next slot it holds, or null", async () => {
        const { client, queues } = await build()

        await client.unschedule("fires", "agent-trigger:t-1")
        expect(queues.get("fires")?.removeJobScheduler).toHaveBeenCalledWith("agent-trigger:t-1")
        expect(await client.nextOf("fires", "agent-trigger:t-1")).toEqual(new Date(123_456))
        queues.get("fires")?.getJobScheduler.mockResolvedValueOnce(undefined)
        expect(await client.nextOf("fires", "agent-trigger:t-1")).toBeNull()
    })
})

describe("workFires", () => {
    it("runs the handler without the durable admission and counts the start from the broker", async () => {
        const { client, factory, delivery, worker, logger } = await build()
        const handler = handlerOf()
        handler.handle.mockResolvedValue(undefined)
        await client.workFires(handler, 4)

        await factory.worker.mock.calls[0]?.[1](brokerJob({ id: "repeat:agent-trigger:t-1:99", attemptsMade: 2 }))
        worker.on.mock.calls[0]?.[1](new Error("redis"))

        expect(factory.worker.mock.calls[0]?.[2].backoffStrategy(2)).toBe(10_000)
        expect(delivery.deliver).not.toHaveBeenCalled()
        expect(handler.handle).toHaveBeenCalledWith(
            expect.objectContaining({ id: "repeat:agent-trigger:t-1:99", payload: { slot: "99" }, attempt: 3 }),
        )
        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.RedisFailed, expect.any(Error), { queue: "knowledge" })
        await factory.worker.mock.calls[0]?.[1](brokerJob({ id: undefined, data: { a: 1 } }))
        expect(handler.handle).toHaveBeenLastCalledWith(expect.objectContaining({ payload: { a: 1 } }))
    })

    it("rethrows a failure so the broker retries it, and says when the budget is spent", async () => {
        const { client, factory, logger } = await build()
        const handler = handlerOf()
        const cause = new Error("db down")
        handler.handle.mockRejectedValue(cause)
        await client.workFires(handler, 1)

        await expect(factory.worker.mock.calls[0]?.[1](brokerJob({ attemptsMade: 0 }))).rejects.toBe(cause)
        await expect(factory.worker.mock.calls[0]?.[1](brokerJob({ attemptsMade: 2 }))).rejects.toBe(cause)

        expect(logger.error).toHaveBeenNthCalledWith(1, QueueLogEvent.DeliveryFailed, cause, expect.any(Object))
        expect(logger.error).toHaveBeenNthCalledWith(2, QueueLogEvent.DeadLettered, cause, expect.any(Object))
    })

    it("ends a job at once when the handler marks the failure unrecoverable", async () => {
        const { client, factory } = await build()
        const handler = handlerOf()
        handler.handle.mockRejectedValue(new QueueError({ code: QueueErrorCode.Unrecoverable }))
        await client.workFires(handler, 1)

        await expect(factory.worker.mock.calls[0]?.[1](brokerJob())).rejects.toBeInstanceOf(UnrecoverableError)
    })
})

describe("close", () => {
    it("stops fetching first, settles the deliveries and then closes the workers and the queues", async () => {
        const { client, delivery, worker, queues } = await build()
        await client.work(handlerOf(), 1)
        await client.add("knowledge", "index", "row-1", {})

        await client.close()

        expect(delivery.stop).toHaveBeenCalledTimes(1)
        expect(worker.pause).toHaveBeenCalledWith(true)
        expect(delivery.abortAll).not.toHaveBeenCalled()
        expect(worker.close).toHaveBeenCalledWith()
        expect(queues.get("knowledge")?.close).toHaveBeenCalledTimes(1)
    })

    it("closes at once when nothing was started", async () => {
        const { client, delivery, worker } = await build()

        await client.close()

        expect(delivery.stop).toHaveBeenCalledTimes(1)
        expect(worker.close).not.toHaveBeenCalled()
    })

    it("aborts the deliveries still running after the grace and waits for them to settle before closing", async () => {
        jest.useFakeTimers()
        const { client, delivery, worker } = await build()
        const finish = gate()
        delivery.settled.mockReturnValue(finish.promise)
        delivery.abortAll.mockImplementation(() => finish.resolve())
        await client.work(handlerOf(), 1)

        const closing = client.close()
        await jest.advanceTimersByTimeAsync(11)
        await closing

        expect(delivery.abortAll).toHaveBeenCalledTimes(1)
        expect(worker.close).toHaveBeenCalledWith()
    })

    it("rejects at the hard deadline while leaving unsettled deliveries and their connections open", async () => {
        jest.useFakeTimers()
        const { client, delivery, worker, queues, logger } = await build()
        delivery.settled.mockReturnValue(new Promise<void>(() => undefined))
        await client.work(handlerOf(), 1)

        const rejected = expect(client.close()).rejects.toMatchObject({ code: QueueErrorCode.ShutdownDeadline })
        await jest.advanceTimersByTimeAsync(5010)
        await rejected

        expect(delivery.abortAll).toHaveBeenCalled()
        expect(worker.close).not.toHaveBeenCalled()
        expect(queues.get("knowledge")?.close).not.toHaveBeenCalled()
        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.ShutdownDeadline, expect.any(QueueError))
    })

    it("caps a stalled pause without forcing worker closure", async () => {
        jest.useFakeTimers()
        const { client, worker } = await build()
        await client.work(handlerOf(), 1)
        worker.pause.mockReturnValue(new Promise<void>(() => undefined))

        const rejected = expect(client.close()).rejects.toMatchObject({ code: QueueErrorCode.ShutdownDeadline })
        await jest.advanceTimersByTimeAsync(5010)
        await rejected

        expect(worker.close).not.toHaveBeenCalled()
    })
})

describe("close, with scheduled fires", () => {
    it("aborts the fires still running when the grace passes", async () => {
        jest.useFakeTimers()
        const { client, delivery, factory } = await build()
        const finish = gate()
        delivery.settled.mockReturnValue(finish.promise)
        delivery.abortAll.mockImplementation(() => finish.resolve())
        const handler = handlerOf()
        handler.handle.mockResolvedValue(undefined)
        await client.workFires(handler, 1)
        await factory.worker.mock.calls[0]?.[1](brokerJob())
        const signal = handler.handle.mock.calls[0]?.[0].signal

        const closing = client.close()
        await jest.advanceTimersByTimeAsync(11)
        await closing

        expect(signal?.aborted).toBe(true)
    })
})
