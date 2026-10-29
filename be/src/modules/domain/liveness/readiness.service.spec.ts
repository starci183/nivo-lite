import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_TIMEOUT } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LivenessError, LivenessErrorCode } from "./errors/liveness.error"
import { ReadinessLogEvent } from "./readiness.log-events"
import { ReadinessService } from "./readiness.service"

/** The statement `callDbFunction` sends for the jobs statistics function. */
const CHECK_READINESS_JOBS = "SELECT * FROM public.job_stats()"

const JOB_ROWS = [{ job_stats: { checkedAt: "2026-10-14T00:00:00.000Z" } }]

const READY_REPORT = { status: "ready", checks: { database: "ok", jobs: "ok" } }

const deferred = <T>() => {
    let resolve: (value: T) => void = () => undefined
    let reject: (reason: unknown) => void = () => undefined
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })
    return { promise, resolve, reject }
}

const build = async (supplied?: MockEntityManager) => {
    const entityManager = supplied ?? mockEntityManager({ query: [CHECK_READINESS_JOBS, JOB_ROWS] })
    const logger = mock<Logger>({ error: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReadinessService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: LOGGER, useValue: logger },
            { provide: QUEUE_TIMEOUT, useValue: timeout },
        ],
    }).compile()
    return { readiness: moduleRef.get(ReadinessService), entityManager, logger }
}

const timeout = mock<QueueTimeout>()

const cancelDeadline = jest.fn()

const deadline = { controller: new AbortController() }

beforeEach(() => {
    deadline.controller = new AbortController()
    cancelDeadline.mockReset()
    timeout.schedule.mockReset()
    timeout.schedule.mockImplementation((callback) => {
        deadline.controller.signal.addEventListener("abort", callback, { once: true })
        return () => {
            cancelDeadline()
            deadline.controller.signal.removeEventListener("abort", callback)
        }
    })
    jest.spyOn(deadline.controller.signal, "addEventListener")
})

afterEach(() => {
    try {
        expect(timeout.schedule).toHaveBeenCalledTimes(1)
        expect(timeout.schedule).toHaveBeenCalledWith(expect.any(Function), 3000)
        expect(cancelDeadline).toHaveBeenCalledTimes(1)
        expect(deadline.controller.signal.addEventListener).toHaveBeenCalledWith("abort", expect.any(Function), {
            once: true,
        })
    } finally {
        jest.restoreAllMocks()
    }
})

describe("ReadinessService / check", () => {
    it("reports readiness after the primary database and job statistics answer", async () => {
        const { readiness, entityManager, logger } = await build()

        await expect(readiness.check()).resolves.toEqual(READY_REPORT)

        expect(entityManager.query).toHaveBeenCalledTimes(1)
        expect(entityManager.query).toHaveBeenCalledWith(CHECK_READINESS_JOBS, [])
        deadline.controller.abort()
        await Promise.resolve()
        expect(logger.error).not.toHaveBeenCalled()
    })
    it("accepts an empty checkedAt because it is non-null", async () => {
        const entityManager = mockEntityManager({ query: [CHECK_READINESS_JOBS, [{ job_stats: { checkedAt: "" } }]] })
        const { readiness, logger } = await build(entityManager)

        await expect(readiness.check()).resolves.toEqual(READY_REPORT)

        expect(logger.error).not.toHaveBeenCalled()
    })
    it("starts the job query before it answers and accepts success before the deadline", async () => {
        const jobs = deferred<Array<unknown>>()
        const entityManager = mockEntityManager()
        entityManager.query.mockReturnValueOnce(jobs.promise)
        const { readiness, logger } = await build(entityManager)
        const settled = jest.fn()

        const check = readiness.check()
        const observed = check.then(settled, settled)
        expect(entityManager.query).toHaveBeenCalledTimes(1)
        await Promise.resolve()

        expect(settled).not.toHaveBeenCalled()
        jobs.resolve(JOB_ROWS)
        await expect(check).resolves.toEqual(READY_REPORT)
        await observed
        expect(logger.error).not.toHaveBeenCalled()
    })
})

describe("ReadinessService / check", () => {
    it("returns the unavailable domain error when the job statistics reject", async () => {
        const cause = new Error("dependency rejected the query")
        const entityManager = mockEntityManager()
        entityManager.query.mockRejectedValueOnce(cause)
        const { readiness, logger } = await build(entityManager)

        const check = readiness.check()

        await expect(check).rejects.toBeInstanceOf(LivenessError)
        await expect(check).rejects.toMatchObject({ code: LivenessErrorCode.ReadinessUnavailable })
        await expect(check).rejects.toHaveProperty("params", {})
        await expect(check).rejects.toHaveProperty("cause", cause)
        await expect(check).rejects.toHaveProperty("message", LivenessErrorCode.ReadinessUnavailable)
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(ReadinessLogEvent.CheckFailed, cause)
    })
})

describe("ReadinessService / check", () => {
    it.each([
        ["no rows", []],
        ["a null row", [null]],
        ["missing statistics", [{}]],
        ["null statistics", [{ job_stats: null }]],
        ["a missing checkedAt", [{ job_stats: {} }]],
        ["a null checkedAt", [{ job_stats: { checkedAt: null } }]],
    ])("refuses readiness with %s in the job statistics result", async (_condition, rows) => {
        const entityManager = mockEntityManager({ query: [CHECK_READINESS_JOBS, rows] })
        const { readiness, logger } = await build(entityManager)

        const check = readiness.check()

        await expect(check).rejects.toBeInstanceOf(LivenessError)
        await expect(check).rejects.toMatchObject({ code: LivenessErrorCode.ReadinessUnavailable })
        await expect(check).rejects.toHaveProperty("params", {})
        await expect(check).rejects.toHaveProperty("cause", expect.any(Error))
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(ReadinessLogEvent.CheckFailed, expect.any(Error))
    })
    it.each([
        [null, "Cannot read properties of null (reading '0')"],
        [undefined, "Cannot read properties of undefined (reading '0')"],
    ])("wraps an invalid %s job query result in the unavailable error", async (rows, causeMessage) => {
        const entityManager = mockEntityManager()
        entityManager.query.mockResolvedValueOnce(rows)
        const { readiness, logger } = await build(entityManager)

        const check = readiness.check()

        await expect(check).rejects.toBeInstanceOf(LivenessError)
        await expect(check).rejects.toMatchObject({ code: LivenessErrorCode.ReadinessUnavailable })
        await expect(check).rejects.toHaveProperty("params", {})
        await expect(check).rejects.toHaveProperty("cause", expect.any(TypeError))
        await expect(check).rejects.toHaveProperty("cause.message", causeMessage)
        expect(entityManager.query).toHaveBeenCalledTimes(1)
        expect(entityManager.query).toHaveBeenCalledWith(CHECK_READINESS_JOBS, [])
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(
            ReadinessLogEvent.CheckFailed,
            expect.objectContaining({ name: "TypeError", message: causeMessage }),
        )
    })
})

describe("ReadinessService / check", () => {
    it("times out the job statistics query at three seconds", async () => {
        const delayed = deferred<unknown>()
        const entityManager = mockEntityManager()
        entityManager.query.mockReturnValueOnce(delayed.promise)
        const { readiness, logger } = await build(entityManager)
        const settled = jest.fn()

        const check = readiness.check()
        const observed = check.then(settled, settled)
        const rejected = expect(check).rejects.toMatchObject({ code: LivenessErrorCode.ReadinessUnavailable })
        await Promise.resolve()
        await Promise.resolve()

        expect(settled).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
        deadline.controller.abort()
        await rejected
        await observed
        await expect(check).rejects.toBeInstanceOf(LivenessError)
        await expect(check).rejects.toHaveProperty("params", {})
        await expect(check).rejects.toHaveProperty("cause", expect.any(Error))
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(ReadinessLogEvent.CheckFailed, expect.any(Error))

        delayed.resolve(JOB_ROWS)
        await Promise.resolve()
        await Promise.resolve()
        expect(logger.error).toHaveBeenCalledTimes(1)
    })
    it("handles a query rejection that arrives after readiness has already timed out", async () => {
        const jobs = deferred<Array<unknown>>()
        const entityManager = mockEntityManager()
        entityManager.query.mockReturnValueOnce(jobs.promise)
        const { readiness, logger } = await build(entityManager)
        const check = readiness.check()
        const rejected = expect(check).rejects.toMatchObject({ code: LivenessErrorCode.ReadinessUnavailable })

        deadline.controller.abort()
        await rejected
        await expect(check).rejects.toHaveProperty("params", {})
        await expect(check).rejects.toHaveProperty("cause", expect.any(Error))
        jobs.reject(new Error("job query rejected after the deadline"))
        await Promise.resolve()
        await Promise.resolve()

        expect(logger.error).toHaveBeenCalledTimes(1)
    })
})
