import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ERROR_REPORTER } from "@modules/platform/errors"
import type { ErrorReporter } from "@modules/platform/errors"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueDelivery, QueueHandler } from "./queue.contracts"
import { QUEUE_OPTIONS } from "./queue.decorators"
import { QueueLogEvent } from "./queue.log-events"
import type { QueueOptions } from "./queue.options"
import { PgmqQueueTransportClient } from "./pgmq-queue-transport.client"
import { JOB_ACK, JOB_ARCHIVE, JOB_ENQUEUE, JOB_FAIL, JOB_READ, JOB_TOUCH } from "./persistence/queue.sql"
import type { QueueReadRow } from "./persistence/queue.rows"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A by-constructor matcher, typed `unknown` so it flows into any slot. */
const anyOf = (type: unknown): unknown => expect.any(type)

const WORKSPACE = "3f0c7a52-8d1e-4b6a-9c2d-5e7f10a4b8c6"

const DEFAULT_OPTIONS: QueueOptions = {
    enabled: true,
    concurrency: 4,
    workspaceConcurrency: 2,
    pollIntervalMs: 250,
    visibilityTimeoutMs: 60_000,
    shutdownGraceMs: 1000,
    schedulers: [],
}

const messageOf = builder<QueueReadRow>({
    msg_id: "1",
    attempt: 1,
    message: {
        name: "knowledge.index",
        payload: { sourceId: "s-1" },
        dedupe: "knowledge.index:s-1",
        outbox_id: "row-1",
    },
})

const failedMessage = (id: string, attempt: number): QueueReadRow =>
    messageOf({ msg_id: id, attempt, message: { name: "knowledge.index", payload: {}, outbox_id: `row-${id}` } })

/** A manager whose reads answer the batches in turn (then nothing) and whose other statements answer `{}` or the failure given for them. */
const script = (
    manager: MockEntityManager,
    batches: ReadonlyArray<ReadonlyArray<QueueReadRow>>,
    refusing: ReadonlyArray<string>,
): void => {
    const pending = [...batches]
    manager.query.mockImplementation((statement: string) => {
        if (refusing.includes(statement)) return Promise.reject(new Error(`${statement} refused`))
        return Promise.resolve(statement === JOB_READ ? (pending.shift() ?? []) : [{}])
    })
}

const build = async (manager: MockEntityManager = mockEntityManager(), options: Partial<QueueOptions> = {}) => {
    const logger = mock<Logger>()
    const reporter = mock<ErrorReporter>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PgmqQueueTransportClient,
            { provide: QUEUE_OPTIONS, useValue: { ...DEFAULT_OPTIONS, ...options } },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: LOGGER, useValue: logger },
            { provide: ERROR_REPORTER, useValue: reporter },
        ],
    }).compile()
    return { client: moduleRef.get(PgmqQueueTransportClient), manager, logger, reporter }
}

/** The client over a scripted manager (see `script`). */
const buildScripted = (
    batches: ReadonlyArray<ReadonlyArray<QueueReadRow>>,
    refusing: ReadonlyArray<string> = [],
    options: Partial<QueueOptions> = {},
) => {
    const manager = mockEntityManager()
    script(manager, batches, refusing)
    return build(manager, options)
}

/** A handler with a failure hook that fails the deliveries whose job id is listed with the cause given for it. */
const handlerOf = (failing: Readonly<Record<string, unknown>> = {}) => {
    const handle = jest.fn((delivery: QueueDelivery) =>
        delivery.id in failing ? Promise.reject(failing[delivery.id]) : Promise.resolve(),
    )
    const failed = jest.fn((_delivery: QueueDelivery, _cause: unknown) => Promise.resolve())
    const handler: QueueHandler = { queue: "knowledge", handle, failed }
    return { handler, handle, failed }
}

/** Starts the worker and stops it the first time it pauses; resolves when the worker stopped. */
const runUntilFirstPause = async (client: PgmqQueueTransportClient, handler: QueueHandler, concurrency = 3) => {
    let stopped: Promise<void> = Promise.resolve()
    let paused: () => void = () => undefined
    const firstPause = new Promise<void>((resolve) => {
        paused = resolve
    })
    const wait = jest.spyOn(client, "wait").mockImplementation((ms) => {
        if (ms !== 250) return new Promise<void>(() => undefined)
        stopped = client.close()
        paused()
        return Promise.resolve()
    })
    await client.work(handler, concurrency)
    await firstPause
    await stopped
    return wait
}

describe("add", () => {
    it("writes the outbox row and the message with the workspace, queue, job, payload and dedupe key, on the connection of the caller's transaction", async () => {
        const { client } = await build()
        const tx = fakeTransaction(mockEntityManager({ query: [JOB_ENQUEUE, [{ id: "row-1" }]] }))

        await tx.em.transaction((manager) =>
            client.add(manager, {
                queue: "knowledge",
                job: "knowledge.index",
                dedupeKey: "knowledge.index:s-1",
                workspaceId: WORKSPACE,
                payload: { sourceId: "s-1" },
            }),
        )

        expect(tx.em.query).toHaveBeenCalledWith(JOB_ENQUEUE, [
            WORKSPACE,
            "knowledge",
            "knowledge.index",
            JSON.stringify({ sourceId: "s-1" }),
            "knowledge.index:s-1",
        ])
        expect(tx.commits).toBe(1)
    })

    it("passes no workspace and no dedupe key for a job that has neither", async () => {
        const { client } = await build()
        const tx = fakeTransaction(mockEntityManager({ query: [JOB_ENQUEUE, [{ id: "row-2" }]] }))

        await tx.em.transaction((manager) =>
            client.add(manager, { queue: "mail", job: "mail", dedupeKey: null, workspaceId: null, payload: {} }),
        )

        expect(tx.em.query).toHaveBeenCalledWith(JOB_ENQUEUE, [null, "mail", "mail", "{}", null])
    })
})

it("reports a dead-lettered failure with its workspace, job and exhausted attempt", async () => {
    const message = messageOf({
        msg_id: "7",
        attempt: 4,
        message: { name: "knowledge.index", payload: { workspaceId: WORKSPACE }, outbox_id: "row-7" },
    })
    const cause = new Error("provider unavailable")
    const { client, manager, reporter } = await buildScripted([[message]])
    const { handler } = handlerOf({ "row-7": cause })

    await runUntilFirstPause(client, handler)

    expect(reporter.report).toHaveBeenCalledTimes(1)
    expect(reporter.report).toHaveBeenCalledWith("job.knowledge", cause, {
        workspaceId: WORKSPACE,
        job: "knowledge.index",
        attempt: 4,
    })
    expect(manager.query).toHaveBeenCalledWith(JOB_ARCHIVE, ["knowledge", "7", "provider unavailable"])
})

it("reads the free slots with the visibility timeout and the workspace limit, runs the batch and acknowledges what completed", async () => {
    const { client, manager } = await buildScripted([[messageOf(), messageOf({ msg_id: "2" })]])
    const { handler, handle } = handlerOf()

    const wait = await runUntilFirstPause(client, handler)

    expect(manager.query).toHaveBeenCalledWith(JOB_READ, ["knowledge", 60, 3, 2])
    expect(handle).toHaveBeenCalledWith({
        id: "row-1",
        queue: "knowledge",
        job: "knowledge.index",
        payload: { sourceId: "s-1" },
        attempt: 1,
        signal: anyOf(AbortSignal),
    })
    expect(manager.query).toHaveBeenCalledWith(JOB_ACK, ["knowledge", "1"])
    expect(manager.query).toHaveBeenCalledWith(JOB_ACK, ["knowledge", "2"])
    expect(wait).toHaveBeenCalledWith(250)
})

it("retries a failed job after the backoff of its attempt with the reason, and a retry-after error after the pause it asked for", async () => {
    const asked = new QueueError({
        code: QueueErrorCode.RetryAfter,
        params: { seconds: 30, reason: "rate limited" },
    })
    const { client, manager, logger } = await buildScripted([[failedMessage("2", 2), failedMessage("3", 1)]])
    const { handler, failed } = handlerOf({ "row-2": new Error("provider down"), "row-3": asked })

    await runUntilFirstPause(client, handler)

    expect(manager.query).toHaveBeenCalledWith(JOB_FAIL, ["knowledge", "2", 10, "provider down"])
    expect(manager.query).toHaveBeenCalledWith(JOB_FAIL, ["knowledge", "3", 30, "rate limited"])
    expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.DeliveryFailed, anyOf(Error), {
        queue: "knowledge",
        messageId: "2",
        job: "knowledge.index",
        attempt: 2,
    })
    expect(failed).not.toHaveBeenCalled()
})

it("archives a job on its last attempt, even one that asked to retry, after its failure hook ran", async () => {
    const asked = new QueueError({ code: QueueErrorCode.RetryAfter, params: { seconds: 30 } })
    const { client, manager, logger } = await buildScripted([[failedMessage("4", 4)]])
    const { handler, failed } = handlerOf({ "row-4": asked })

    await runUntilFirstPause(client, handler)

    expect(failed).toHaveBeenCalledWith(objectLike({ id: "row-4", attempt: 4 }), asked)
    expect(manager.query).toHaveBeenCalledWith(JOB_ARCHIVE, ["knowledge", "4", "QUEUE_RETRY_AFTER"])
    expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.DeadLettered, asked, {
        queue: "knowledge",
        messageId: "4",
        job: "knowledge.index",
        attempt: 4,
    })
})

it("archives an unrecoverable failure on its first attempt with its reason, and does not run a hook the handler does not have", async () => {
    const refused = new QueueError({
        code: QueueErrorCode.Unrecoverable,
        params: { reason: "blocked_credits" },
    })
    const { client, manager } = await buildScripted([[failedMessage("5", 1)]])
    const { handle } = handlerOf({ "row-5": refused })
    const handler: QueueHandler = { queue: "knowledge", handle }

    await runUntilFirstPause(client, handler)

    expect(manager.query).toHaveBeenCalledWith(JOB_ARCHIVE, ["knowledge", "5", "blocked_credits"])
})

it("archives the job even when its failure hook throws, and logs the hook", async () => {
    const { client, manager, logger } = await buildScripted([[failedMessage("6", 4)]])
    const { handler, failed } = handlerOf({ "row-6": new Error("gave up") })
    const hook = new Error("hook broke")
    failed.mockRejectedValue(hook)

    await runUntilFirstPause(client, handler)

    expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.FailureHookFailed, hook, {
        queue: "knowledge",
        job: "knowledge.index",
    })
    expect(manager.query).toHaveBeenCalledWith(JOB_ARCHIVE, ["knowledge", "6", "gave up"])
})

it("logs a read that failed and pauses before reading again", async () => {
    const { client, manager, logger } = await buildScripted([])
    const failure = new Error("pgmq unreachable")
    manager.query.mockRejectedValueOnce(failure)

    await runUntilFirstPause(client, handlerOf().handler)

    expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.ReadFailed, failure, { queue: "knowledge" })
})

it("logs a message it could not settle, leaving it to reappear after its visibility timeout", async () => {
    const { client, logger } = await buildScripted([[messageOf()]], [JOB_ACK])

    await runUntilFirstPause(client, handlerOf().handler)

    expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.SettleFailed, anyOf(Error), {
        queue: "knowledge",
        messageId: "1",
    })
})

it("reads again as soon as a running job frees its slot when every slot is taken", async () => {
    const { client, manager } = await buildScripted([
        [messageOf(), messageOf({ msg_id: "2" })],
        [messageOf({ msg_id: "3" })],
    ])
    const { handler, handle } = handlerOf()

    const wait = await runUntilFirstPause(client, handler, 2)

    expect(handle).toHaveBeenCalledTimes(3)
    expect(manager.query.mock.calls.filter(([statement]) => statement === JOB_READ)).toHaveLength(2)
    expect(wait.mock.calls.filter(([ms]) => ms === 250)).toHaveLength(1)
})

it("does not pause after an empty read once it is closing", async () => {
    const { client, manager } = await buildScripted([])
    const wait = jest.spyOn(client, "wait").mockImplementation(() => new Promise<void>(() => undefined))
    let stopped: Promise<void> = Promise.resolve()
    manager.query.mockImplementation(() => {
        stopped = client.close()
        return Promise.resolve([])
    })

    await client.work(handlerOf().handler, 3)
    await new Promise<void>((resolve) => setImmediate(resolve))
    await stopped

    expect(wait).not.toHaveBeenCalledWith(250)
})

describe("while a handler runs", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it("renews the visibility timeout every third of it and logs a renewal that failed", async () => {
        const { client, manager, logger } = await buildScripted([])
        const refused = new Error("touch refused")
        manager.query.mockImplementationOnce(() => Promise.resolve([messageOf()]))
        manager.query.mockImplementationOnce(() => Promise.reject(refused))
        let finish: () => void = () => undefined
        const handler: QueueHandler = {
            queue: "knowledge",
            handle: () =>
                new Promise<void>((resolve) => {
                    finish = resolve
                }),
        }

        await client.work(handler, 1)
        await jest.advanceTimersByTimeAsync(40_000)
        finish()
        await jest.advanceTimersByTimeAsync(0)
        const closing = client.close()
        await jest.advanceTimersByTimeAsync(2000)
        await closing

        expect(manager.query).toHaveBeenCalledWith(JOB_TOUCH, ["knowledge", "1", 60])
        expect(logger.error).toHaveBeenCalledWith(QueueLogEvent.TouchFailed, refused, {
            queue: "knowledge",
            messageId: "1",
        })
        expect(manager.query).toHaveBeenCalledWith(JOB_ACK, ["knowledge", "1"])
    })

    it("aborts a delivery that outlives the shutdown grace and hands its message back at once", async () => {
        const { client, manager, logger } = await buildScripted([[messageOf()]], [], { shutdownGraceMs: 500 })
        const handler: QueueHandler = {
            queue: "knowledge",
            handle: (delivery) =>
                new Promise<void>((_resolve, reject) => {
                    delivery.signal.addEventListener("abort", () => reject(new Error("aborted")))
                }),
        }

        await client.work(handler, 1)
        await jest.advanceTimersByTimeAsync(0)
        const closing = client.close()
        await jest.advanceTimersByTimeAsync(500)
        await closing

        expect(manager.query).toHaveBeenCalledWith(JOB_FAIL, ["knowledge", "1", 0, "worker shutting down"])
        expect(logger.warn).toHaveBeenCalledWith(QueueLogEvent.HandedBack, {
            queue: "knowledge",
            messageId: "1",
            job: "knowledge.index",
            attempt: 1,
        })
    })
})

describe("wait", () => {
    it("waits for the requested delay", async () => {
        jest.useFakeTimers()
        try {
            const { client } = await build()

            const waiting = client.wait(250)
            await jest.advanceTimersByTimeAsync(250)

            await expect(waiting).resolves.toBeUndefined()
        } finally {
            jest.useRealTimers()
        }
    })
})

describe("close", () => {
    it("resolves at once when no worker runs", async () => {
        const { client } = await build()

        await expect(client.close()).resolves.toBeUndefined()
    })
})
