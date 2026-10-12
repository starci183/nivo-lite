import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueDelivery, QueueHandler } from "./queue.contracts"
import { QUEUE_OPTIONS, QUEUE_TRANSPORT } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import type { QueueTransport } from "./queue-transport.port"
import { QueueWorkerService } from "./queue-worker.service"

const options: QueueOptions = {
    enabled: true,
    concurrency: 3,
    workspaceConcurrency: 2,
    pollIntervalMs: 100,
    visibilityTimeoutMs: 30_000,
    shutdownGraceMs: 1000,
    schedulers: [{ queue: "sweep", id: "sweep-every-minute", everyMs: 60000 }],
}

const handlerOf = (queue: string, job?: string, extra: Partial<QueueHandler> = {}): QueueHandler => ({
    queue,
    job,
    handle: jest.fn(() => Promise.resolve()),
    ...extra,
})

const deliveryOf = (queue: string, job: string): QueueDelivery => ({
    id: "row-1",
    queue,
    job,
    payload: {},
    attempt: 1,
    signal: new AbortController().signal,
})

const build = async (overrides: Partial<QueueOptions> = {}) => {
    const transport = mock<QueueTransport>()
    transport.upsertScheduler.mockResolvedValue(undefined)
    transport.work.mockResolvedValue(undefined)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            QueueWorkerService,
            { provide: QUEUE_OPTIONS, useValue: { ...options, ...overrides } },
            { provide: QUEUE_TRANSPORT, useValue: transport },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { workers: moduleRef.get(QueueWorkerService), transport, logger }
}

/** The router the worker service handed the transport for a queue. */
const routerOf = (transport: ReturnType<typeof mock<QueueTransport>>, queue: string): QueueHandler => {
    const call = transport.work.mock.calls.find(([handler]) => handler.queue === queue)
    if (call === undefined) {
        throw new QueueError({ code: QueueErrorCode.HandlerMissing, params: { queue, job: queue } })
    }
    return call[0]
}

describe("QueueWorkerService", () => {
    describe("add", () => {
        it("refuses a second handler for the same queue and job", async () => {
            const { workers } = await build()
            workers.add(handlerOf("knowledge", "knowledge.index"))

            expect(() => workers.add(handlerOf("knowledge", "knowledge.index"))).toThrow(QueueError)
            expect(() => workers.add(handlerOf("knowledge"))).not.toThrow()
            expect(() => workers.add(handlerOf("knowledge"))).toThrow(QueueError)
        })
    })

    describe("onApplicationBootstrap", () => {
        it("starts one worker per queue, however many jobs it has, and registers the schedulers", async () => {
            const { workers, transport } = await build()
            workers.add(handlerOf("knowledge", "knowledge.index"))
            workers.add(handlerOf("knowledge", "knowledge.facts"))
            workers.add(handlerOf("sweep"))

            await workers.onApplicationBootstrap()

            expect(transport.work).toHaveBeenCalledTimes(2)
            expect(transport.work).toHaveBeenCalledWith(expect.objectContaining({ queue: "knowledge" }), 3)
            expect(transport.work).toHaveBeenCalledWith(expect.objectContaining({ queue: "sweep" }), 3)
            expect(transport.upsertScheduler).toHaveBeenCalledWith(options.schedulers[0])
        })

        it("runs a queue as many deliveries at once as its busiest handler asks for", async () => {
            const { workers, transport } = await build()
            workers.add(handlerOf("render", "render.video", { concurrency: 1 }))
            workers.add(handlerOf("render", "render.thumbnail", { concurrency: 6 }))

            await workers.onApplicationBootstrap()

            expect(transport.work).toHaveBeenCalledWith(expect.objectContaining({ queue: "render" }), 6)
        })

        it("starts no worker when the consumer is off, says so, and still registers the schedulers", async () => {
            const { workers, transport, logger } = await build({ enabled: false })
            workers.add(handlerOf("knowledge"))

            await workers.onApplicationBootstrap()

            expect(transport.work).not.toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith(QueueLogEvent.ConsumerDisabled, { queues: ["knowledge"] })
            expect(transport.upsertScheduler).toHaveBeenCalledTimes(1)
        })

        it("logs a scheduler that cannot be registered and still starts the app", async () => {
            const { workers, transport, logger } = await build()
            const failure = new Error("pg_cron missing")
            transport.upsertScheduler.mockRejectedValue(failure)

            await expect(workers.onApplicationBootstrap()).resolves.toBeUndefined()

            expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.SchedulerFailed, failure, {
                scheduler: "sweep-every-minute",
            })
        })
    })

    describe("routing", () => {
        it("hands a delivery to the handler of its job, else to the handler of the whole queue", async () => {
            const { workers, transport } = await build()
            const index = handlerOf("knowledge", "knowledge.index")
            const whole = handlerOf("knowledge")
            workers.add(index)
            workers.add(whole)
            await workers.onApplicationBootstrap()
            const router = routerOf(transport, "knowledge")

            await router.handle(deliveryOf("knowledge", "knowledge.index"))
            await router.handle(deliveryOf("knowledge", "knowledge.facts"))

            expect(index.handle).toHaveBeenCalledTimes(1)
            expect(whole.handle).toHaveBeenCalledTimes(1)
        })

        it("rejects a job no handler names with the error that ends it at once", async () => {
            const { workers, transport } = await build()
            workers.add(handlerOf("knowledge", "knowledge.index"))
            await workers.onApplicationBootstrap()

            await expect(
                routerOf(transport, "knowledge").handle(deliveryOf("knowledge", "knowledge.facts")),
            ).rejects.toMatchObject({
                code: QueueErrorCode.HandlerMissing,
            })
        })

        it("hands the failure of a job to the failure hook of its handler, and ignores a job without one", async () => {
            const { workers, transport } = await build()
            const failed = jest.fn(() => Promise.resolve())
            workers.add(handlerOf("knowledge", "knowledge.index", { failed }))
            workers.add(handlerOf("knowledge", "knowledge.facts"))
            await workers.onApplicationBootstrap()
            const router = routerOf(transport, "knowledge")
            const cause = new Error("gave up")
            const delivery = deliveryOf("knowledge", "knowledge.index")

            await router.failed?.(delivery, cause)
            await router.failed?.(deliveryOf("knowledge", "knowledge.facts"), cause)
            await router.failed?.(deliveryOf("knowledge", "knowledge.reembed"), cause)

            expect(failed).toHaveBeenCalledTimes(1)
            expect(failed).toHaveBeenCalledWith(delivery, cause)
        })
    })

    describe("onApplicationShutdown", () => {
        it("stops the workers", async () => {
            const { workers, transport } = await build()

            await workers.onApplicationShutdown()

            expect(transport.close).toHaveBeenCalledTimes(1)
        })
    })
})
