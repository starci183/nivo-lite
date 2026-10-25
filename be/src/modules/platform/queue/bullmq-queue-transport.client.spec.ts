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
import { BullmqQueueTransportClient } from "./bullmq-queue-transport.client"
import type { QueueDelivery, QueueHandler } from "./queue.contracts"
import { QUEUE_FACTORY, QUEUE_OPTIONS } from "./queue.decorators"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueOptions } from "./queue.options"
import { deferMsOf } from "./queue.policy"
import type { BullmqJob, BullmqJobOptions, BullmqQueue, BullmqWorker, QueueFactory } from "./queue-transport.port"
import type { QueueStartRow } from "./persistence/queue.rows"

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

/** The durable answers the client's statements get. */
interface DurableAnswers {
    start?: Array<QueueStartRow>
}

/** What the queue double recorded of one `add`. */
interface RecordedAdd {
    queue: string
    name: string
    payload: object
    options: BullmqJobOptions
}

interface TransportWorld {
    client: BullmqQueueTransportClient
    factory: MockOf<QueueFactory>
    worker: MockOf<BullmqWorker>
    queues: Map<string, MockOf<BullmqQueue>>
    adds: Array<RecordedAdd>
    held: Map<string, MockOf<BullmqJob>>
    em: MockEntityManager
    logger: MockOf<Logger>
    reporter: MockOf<ErrorReporter>
    clock: FakeClock
}

const brokerJob = (job: Partial<BullmqJob> = {}): MockOf<BullmqJob> =>
    mock<BullmqJob>({ id: "row-1", name: "knowledge.index", data: {}, attemptsMade: 0, ...job })

const handlerOf = (job?: string, extra: Partial<QueueHandler> = {}): MockOf<QueueHandler> => {
    const handler = mock<QueueHandler>({ queue: "knowledge", job, ...extra })
    if (extra.handle === undefined) handler.handle.mockResolvedValue(undefined)
    return handler
}

const statementsOf = (em: MockEntityManager): Array<string> => em.query.mock.calls.map(([sql]) => String(sql))

const build = async (answers: DurableAnswers = {}): Promise<TransportWorld> => {
    const adds: Array<RecordedAdd> = []
    const held = new Map<string, MockOf<BullmqJob>>()
    const queues = new Map<string, MockOf<BullmqQueue>>()
    const factory = mock<QueueFactory>()
    const worker = mock<BullmqWorker>()
    factory.queue.mockImplementation((name: string) => {
        const known = queues.get(name)
        if (known !== undefined) return known
        const queue = mock<BullmqQueue>()
        queue.add.mockImplementation((job, payload, addOptions) => {
            adds.push({ queue: name, name: job, payload, options: addOptions })
            const key = `${name}:${addOptions.jobId}`
            if (!held.has(key)) held.set(key, brokerJob({ id: addOptions.jobId, name: job, data: payload }))
            return Promise.resolve(held.get(key))
        })
        queue.getJob.mockImplementation((id: string) => Promise.resolve(held.get(`${name}:${id}`)))
        queue.close.mockResolvedValue(undefined)
        queues.set(name, queue)
        return queue
    })
    factory.worker.mockReturnValue(worker)
    const em = mockEntityManager()
    em.query.mockImplementation((sql: unknown) => {
        const text = String(sql)
        if (text.includes("job_start")) return Promise.resolve(answers.start ?? [{ outcome: "started", attempt: 1 }])
        return Promise.resolve([])
    })
    const clock = new FakeClock(1_000_000)
    const logger = mock<Logger>()
    const reporter = mock<ErrorReporter>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BullmqQueueTransportClient,
            { provide: QUEUE_OPTIONS, useValue: options },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: QUEUE_FACTORY, useValue: factory },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: clock },
            { provide: ERROR_REPORTER, useValue: reporter },
        ],
    }).compile()
    return {
        client: moduleRef.get(BullmqQueueTransportClient),
        factory,
        worker,
        queues,
        adds,
        held,
        em,
        logger,
        reporter,
        clock,
    }
}

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
                backoff: { type: "exponential", delay: 5000 },
                removeOnComplete: { age: 3600 },
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
                maxRetriesPerRequest: null,
            },
        })
    })
})

describe("stateOf", () => {
    it("answers missing when the broker holds nothing under the id, else the mapped state", async () => {
        const { client, held } = await build()
        held.set("knowledge:row-1", brokerJob({ getState: jest.fn(() => Promise.resolve("delayed")) }))

        expect(await client.stateOf("knowledge", "row-1")).toBe("delayed")
        expect(await client.stateOf("knowledge", "gone")).toBe("missing")
    })
})

describe("republish", () => {
    it("drops the job the broker holds and adds it again under the same id", async () => {
        const { client, held, adds } = await build()
        const job = brokerJob({ id: "row-1" })
        held.set("knowledge:row-1", job)

        await client.republish("knowledge", "knowledge.index", "row-1", { sourceId: "s-1" })

        expect(job.remove).toHaveBeenCalledTimes(1)
        expect(adds).toHaveLength(1)
        expect(adds[0]?.options.jobId).toBe("row-1")
    })
})

describe("work", () => {
    it("starts the worker of the queue on the shared connection, its concurrency and the lock the lease mirrors", async () => {
        const { client, factory } = await build()

        await client.work(handlerOf("knowledge.index"), 5)

        const workerOptions = factory.worker.mock.calls[0]?.[2]
        expect(workerOptions?.prefix).toBe("proof")
        expect(workerOptions?.connection).toEqual({
            host: "redis.invalid",
            port: 6380,
            db: 3,
            password: undefined,
            maxRetriesPerRequest: null,
        })
        expect(workerOptions?.concurrency).toBe(5)
        expect(workerOptions?.lockDuration).toBe(30_000)
        expect(workerOptions?.backoffStrategy(2)).toBe(10_000)
    })
})

describe("deliveries", () => {
    it("admits a delivery, runs its handler and closes the row done", async () => {
        const { client, factory, em } = await build({ start: [{ outcome: "started", attempt: 2 }] })
        const handler = handlerOf("knowledge.index")
        await client.work(handler, 1)
        const processor = factory.worker.mock.calls[0]?.[1]

        await processor?.(brokerJob({ id: "row-1", name: "knowledge.index", data: { sourceId: "s-1" } }), "token")

        const delivery = handler.handle.mock.calls[0]?.[0]
        expect(delivery?.signal).toBeInstanceOf(AbortSignal)
        expect({
            id: delivery?.id,
            queue: delivery?.queue,
            job: delivery?.job,
            payload: delivery?.payload,
            attempt: delivery?.attempt,
        }).toEqual({
            id: "row-1",
            queue: "knowledge",
            job: "knowledge.index",
            payload: { sourceId: "s-1" },
            attempt: 2,
        })
        const statements = statementsOf(em)
        expect(statements.some((sql) => sql.includes("job_start"))).toBe(true)
        expect(statements.some((sql) => sql.includes("job_done"))).toBe(true)
    })

    it("moves a job the workspace limit refuses back to delayed and never runs it", async () => {
        const { client, factory } = await build({ start: [{ outcome: "busy", attempt: 0 }] })
        const handler = handlerOf("knowledge.index")
        await client.work(handler, 1)
        const processor = factory.worker.mock.calls[0]?.[1]
        const job = brokerJob()

        await expect(processor?.(job, "token")).rejects.toBeInstanceOf(DelayedError)
        expect(handler.handle).not.toHaveBeenCalled()
        expect(job.moveToDelayed).toHaveBeenCalledWith(1_000_000 + deferMsOf("row-1"), "token")
    })

    it("ends a delivery of a row the record says is done or gone, without running it", async () => {
        const { client, factory } = await build({ start: [{ outcome: "terminal", attempt: 0 }] })
        const handler = handlerOf("knowledge.index")
        await client.work(handler, 1)
        const processor = factory.worker.mock.calls[0]?.[1]

        await expect(processor?.(brokerJob(), "token")).resolves.toBeUndefined()
        expect(handler.handle).not.toHaveBeenCalled()
    })
})

describe("delivery failures", () => {
    it("retries a failed delivery on the durable row and lets the broker keep the pause", async () => {
        const { client, factory, em } = await build({ start: [{ outcome: "started", attempt: 1 }] })
        const failure = new Error("provider down")
        const handler = handlerOf("knowledge.index", { handle: jest.fn(() => Promise.reject(failure)) })
        await client.work(handler, 1)
        const processor = factory.worker.mock.calls[0]?.[1]

        await expect(processor?.(brokerJob(), "token")).rejects.toBe(failure)
        const statements = statementsOf(em)
        expect(statements.some((sql) => sql.includes("job_retry"))).toBe(true)
        expect(statements.some((sql) => sql.includes("job_dead"))).toBe(false)
    })

    it("dead-letters a delivery that may not run again: failure hook once, the row failed, no broker retry", async () => {
        const { client, factory, em, reporter } = await build({ start: [{ outcome: "started", attempt: 1 }] })
        const cause = new QueueError({ code: QueueErrorCode.Unrecoverable, params: { reason: "blocked" } })
        const failed = jest.fn((_delivery: QueueDelivery, _cause: unknown) => Promise.resolve())
        const handler = handlerOf("knowledge.index", {
            handle: jest.fn(() => Promise.reject(cause)),
            failed,
        })
        await client.work(handler, 1)
        const processor = factory.worker.mock.calls[0]?.[1]

        await expect(processor?.(brokerJob(), "token")).rejects.toBeInstanceOf(UnrecoverableError)
        expect(failed).toHaveBeenCalledTimes(1)
        expect(reporter.report).toHaveBeenCalledWith("job.knowledge", cause, {
            workspaceId: null,
            job: "knowledge.index",
            attempt: 1,
        })
        const statements = statementsOf(em)
        expect(statements.some((sql) => sql.includes("job_dead"))).toBe(true)
    })
})

describe("close", () => {
    it("hands a running delivery back after the grace and closes the workers and queues", async () => {
        const { client, factory, em, worker, queues } = await build()
        let aborted: QueueDelivery | undefined
        const handler = handlerOf("knowledge.index", {
            handle: (delivery) =>
                new Promise<void>((_resolve, reject) => {
                    delivery.signal.addEventListener("abort", () => {
                        aborted = delivery
                        reject(new Error("aborted"))
                    })
                }),
        })
        await client.work(handler, 1)
        const processor = factory.worker.mock.calls[0]?.[1]
        const running = (processor?.(brokerJob(), "token") ?? Promise.resolve()).catch((cause: unknown) => cause)

        await client.close()

        expect(await running).toBeInstanceOf(DelayedError)
        expect(aborted).toBeDefined()
        const statements = statementsOf(em)
        expect(statements.some((sql) => sql.includes("job_retry"))).toBe(true)
        expect(worker.close).toHaveBeenCalledWith(true)
        expect([...queues.values()].every((queue) => queue.close.mock.calls.length > 0)).toBe(true)
    })

    it("closes at once when nothing runs", async () => {
        const { client, worker } = await build()

        await client.close()

        expect(worker.close).not.toHaveBeenCalled()
    })
})
