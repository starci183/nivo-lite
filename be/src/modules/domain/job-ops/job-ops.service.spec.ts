import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { JobOpsErrorCode } from "./errors/job-ops.error"
import { JobOpsLogEvent } from "./job-ops.log-events"
import { JobOpsService } from "./job-ops.service"
/** The statements `callDbFunction` sends for the jobs functions. */
const READ_JOB_STATS = "SELECT * FROM public.job_stats()"
const READ_FAILED_JOBS = "SELECT * FROM public.job_failed($1)"
const READ_OPEN_JOBS = "SELECT * FROM public.job_open($1)"
const REQUEUE_JOB = "SELECT * FROM public.job_reopen($1)"
const REQUEUE_FAILED_JOBS = "SELECT * FROM public.job_requeue_failed($1)"

const OUTBOX_ID = "12345678-1234-1234-1234-123456789abc"
const STATS = {
    queues: {},
    running: 2,
    failed24h: 3,
    oldestQueuedAgeSeconds: 600,
    checkedAt: "2026-10-14T00:00:00.000Z",
}
const UNKNOWN_WATCHDOG = { failed24h: -1, oldestQueuedAgeSeconds: -1 }
const INVALID_LIMITS = [0, -1, 201, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
const INVALID_HOURS = [0, -1, 721, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

const build = async (em: MockEntityManager, loggerOverrides?: Partial<Logger>) => {
    const logger = mock<Logger>(loggerOverrides)
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobOpsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return moduleRef.get(JobOpsService)
}

describe("JobOpsService / stats", () => {
    it("reads and returns the database jsonb statistics on the primary connection", async () => {
        const em = mockEntityManager({ query: [READ_JOB_STATS, [{ job_stats: STATS }]] })
        const service = await build(em)

        await expect(service.stats()).resolves.toBe(STATS)
        expect(em.query).toHaveBeenCalledWith(READ_JOB_STATS, [])
        expect(em.query).toHaveBeenCalledTimes(1)
    })

    it("preserves a null statistics result", async () => {
        const em = mockEntityManager({ query: [READ_JOB_STATS, [{ job_stats: null }]] })
        const service = await build(em)

        await expect(service.stats()).resolves.toBeNull()
    })

    it("propagates an error reading the statistics", async () => {
        const em = mockEntityManager()
        const cause = new Error("statistics unavailable")
        em.query.mockRejectedValue(cause)
        const service = await build(em)

        await expect(service.stats()).rejects.toBe(cause)
    })
})

describe.each([
    ["failed", READ_FAILED_JOBS],
    ["open", READ_OPEN_JOBS],
] as const)("JobOpsService / %s", (operation, query) => {
    it.each(INVALID_LIMITS)("rejects invalid limit %s before accessing the database", async (limit) => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service[operation](limit)).rejects.toMatchObject({ code: JobOpsErrorCode.LimitInvalid })
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([1, 200])("binds valid limit %s and returns an empty list when no jobs match", async (limit) => {
        const em = mockEntityManager({ query: [query, []] })
        const service = await build(em)

        await expect(service[operation](limit)).resolves.toEqual([])
        expect(em.query).toHaveBeenCalledWith(query, [limit])
        expect(em.query).toHaveBeenCalledTimes(1)
    })

    it("propagates a database error reading the jobs", async () => {
        const em = mockEntityManager()
        const cause = new Error("job listing unavailable")
        em.query.mockRejectedValue(cause)
        const service = await build(em)

        await expect(service[operation](25)).rejects.toBe(cause)
    })
})

describe("JobOpsService / failed rows", () => {
    it("maps only safe columns in output order and normalizes Date, offset text and null timestamps", async () => {
        const em = mockEntityManager({
            query: [
                READ_FAILED_JOBS,
                [
                    {
                        last_error: "first failure",
                        finished_at: new Date("2026-10-14T01:02:03.456Z"),
                        attempts: 2,
                        name: "first-job",
                        id: OUTBOX_ID,
                        payload: { internal: true },
                    },
                    {
                        last_error: null,
                        finished_at: "2026-10-14T08:04:05.678+07:00",
                        attempts: 3,
                        name: "second-job",
                        id: "22345678-1234-1234-1234-123456789abc",
                        payload: { internal: true },
                    },
                    {
                        last_error: null,
                        finished_at: null,
                        attempts: 0,
                        name: "third-job",
                        id: "32345678-1234-1234-1234-123456789abc",
                        payload: { internal: true },
                    },
                ],
            ],
        })
        const service = await build(em)

        const rows = await service.failed(25)

        expect(rows).toEqual([
            {
                id: OUTBOX_ID,
                name: "first-job",
                attempts: 2,
                finished_at: "2026-10-14T01:02:03.456Z",
                last_error: "first failure",
            },
            {
                id: "22345678-1234-1234-1234-123456789abc",
                name: "second-job",
                attempts: 3,
                finished_at: "2026-10-14T01:04:05.678Z",
                last_error: null,
            },
            {
                id: "32345678-1234-1234-1234-123456789abc",
                name: "third-job",
                attempts: 0,
                finished_at: null,
                last_error: null,
            },
        ])
        for (const row of rows) {
            expect(Object.keys(row)).toEqual(["id", "name", "attempts", "finished_at", "last_error"])
        }
        expect(em.query).toHaveBeenCalledWith(READ_FAILED_JOBS, [25])
        expect(em.query).toHaveBeenCalledTimes(1)
    })
})

describe("JobOpsService / open rows", () => {
    it("maps safe queued and running columns in order and normalizes timestamps", async () => {
        const em = mockEntityManager({
            query: [
                READ_OPEN_JOBS,
                [
                    {
                        last_error: null,
                        created_at: new Date("2026-10-14T01:02:03.456Z"),
                        attempts: 0,
                        state: "queued",
                        name: "first-job",
                        id: OUTBOX_ID,
                        payload: { internal: true },
                    },
                    {
                        last_error: "previous failure",
                        created_at: "2026-10-14T08:04:05.678+07:00",
                        attempts: 2,
                        state: "running",
                        name: "second-job",
                        id: "22345678-1234-1234-1234-123456789abc",
                        payload: { internal: true },
                    },
                ],
            ],
        })
        const service = await build(em)

        const rows = await service.open(25)

        expect(rows).toEqual([
            {
                id: OUTBOX_ID,
                name: "first-job",
                state: "queued",
                attempts: 0,
                created_at: "2026-10-14T01:02:03.456Z",
                last_error: null,
            },
            {
                id: "22345678-1234-1234-1234-123456789abc",
                name: "second-job",
                state: "running",
                attempts: 2,
                created_at: "2026-10-14T01:04:05.678Z",
                last_error: "previous failure",
            },
        ])
        for (const row of rows) {
            expect(Object.keys(row)).toEqual(["id", "name", "state", "attempts", "created_at", "last_error"])
        }
        expect(em.query).toHaveBeenCalledWith(READ_OPEN_JOBS, [25])
        expect(em.query).toHaveBeenCalledTimes(1)
    })
})

describe("JobOpsService / requeue", () => {
    it.each([
        "",
        "not-a-uuid",
        "12345678-1234-1234-1234-123456789abg",
        "12345678123412341234123456789abc",
        "12345678-1234-1234-1234-123456789ab",
        "12345678-1234-1234-1234-123456789abcd",
        ` ${OUTBOX_ID}`,
        `${OUTBOX_ID} `,
        `${OUTBOX_ID}\n`,
    ])("rejects invalid outbox id %j before accessing the database", async (outboxId) => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.requeue(outboxId)).rejects.toMatchObject({ code: JobOpsErrorCode.IdInvalid })
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([OUTBOX_ID, OUTBOX_ID.toUpperCase(), "00000000-0000-0000-0000-000000000000"])(
        "requeues canonical UUID %s without losing bigint precision",
        async (outboxId) => {
            const em = mockEntityManager({ query: [REQUEUE_JOB, [{ job_reopen: "9223372036854775807" }]] })
            const service = await build(em)

            await expect(service.requeue(outboxId)).resolves.toBe("9223372036854775807")
            expect(em.query).toHaveBeenCalledWith(REQUEUE_JOB, [outboxId])
            expect(em.query).toHaveBeenCalledTimes(1)
        },
    )

    it("returns null when the outbox id is not a failed job", async () => {
        const em = mockEntityManager({ query: [REQUEUE_JOB, [{ job_reopen: null }]] })
        const service = await build(em)

        await expect(service.requeue(OUTBOX_ID)).resolves.toBeNull()
    })

    it("propagates a database error while requeueing", async () => {
        const em = mockEntityManager()
        const cause = new Error("requeue unavailable")
        em.query.mockRejectedValue(cause)
        const service = await build(em)

        await expect(service.requeue(OUTBOX_ID)).rejects.toBe(cause)
    })
})

describe("JobOpsService / requeueFailed", () => {
    it.each(INVALID_HOURS)("rejects invalid hours %s before accessing the database", async (hours) => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.requeueFailed(hours)).rejects.toMatchObject({ code: JobOpsErrorCode.HoursInvalid })
        expect(em.query).not.toHaveBeenCalled()
    })

    it.each([1, 720])("binds valid hours %s to the bulk retry function", async (hours) => {
        const em = mockEntityManager({
            query: [REQUEUE_FAILED_JOBS, [{ job_requeue_failed: { requeued: 2, failed: 3 } }]],
        })
        const service = await build(em)

        await expect(service.requeueFailed(hours)).resolves.toEqual({ requeued: 2, failed: 3 })
        expect(em.query).toHaveBeenCalledWith(REQUEUE_FAILED_JOBS, [hours])
        expect(em.query).toHaveBeenCalledTimes(1)
    })

    it.each([
        { requeued: 0, failed: 0 },
        { requeued: 0, failed: 3 },
        { requeued: 2, failed: 3 },
        { requeued: 3, failed: 3 },
    ])("returns only the bulk retry counters %j", async (result) => {
        const em = mockEntityManager({
            query: [REQUEUE_FAILED_JOBS, [{ job_requeue_failed: { ...result, internal: true } }]],
        })
        const service = await build(em)

        const counters = await service.requeueFailed(24)

        expect(counters).toEqual(result)
        expect(Object.keys(counters)).toEqual(["requeued", "failed"])
    })

    it("counts nothing when the bulk retry function answers no row", async () => {
        const em = mockEntityManager({ query: [REQUEUE_FAILED_JOBS, []] })
        const service = await build(em)

        await expect(service.requeueFailed(24)).resolves.toEqual({ requeued: 0, failed: 0 })
    })

    it("propagates a database error while bulk requeueing", async () => {
        const em = mockEntityManager()
        const cause = new Error("bulk requeue unavailable")
        em.query.mockRejectedValue(cause)
        const service = await build(em)

        await expect(service.requeueFailed(24)).rejects.toBe(cause)
    })
})

describe("JobOpsService / watchdog", () => {
    it("returns both watchdog values from checked statistics", async () => {
        const em = mockEntityManager({ query: [READ_JOB_STATS, [{ job_stats: STATS }]] })
        const logger = mock<Logger>()
        const service = await build(em, { error: logger.error })

        await expect(service.watchdog()).resolves.toEqual({ failed24h: 3, oldestQueuedAgeSeconds: 600 })
        expect(em.query).toHaveBeenCalledWith(READ_JOB_STATS, [])
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("preserves zero values from checked statistics", async () => {
        const em = mockEntityManager({
            query: [READ_JOB_STATS, [{ job_stats: { ...STATS, failed24h: 0, oldestQueuedAgeSeconds: 0 } }]],
        })
        const logger = mock<Logger>()
        const service = await build(em, { error: logger.error })

        await expect(service.watchdog()).resolves.toEqual({ failed24h: 0, oldestQueuedAgeSeconds: 0 })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it.each([
        ["null statistics", null],
        ["an absent check timestamp", { queues: {}, running: 2, failed24h: 3, oldestQueuedAgeSeconds: 600 }],
        ["a null check timestamp", { ...STATS, checkedAt: null }],
        ["an empty check timestamp", { ...STATS, checkedAt: "" }],
    ])("reports unknown watchdog values for %s", async (_name, stats) => {
        const em = mockEntityManager({ query: [READ_JOB_STATS, [{ job_stats: stats }]] })
        const logger = mock<Logger>()
        const service = await build(em, { error: logger.error })

        await expect(service.watchdog()).resolves.toEqual(UNKNOWN_WATCHDOG)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it.each([new Error("statistics unavailable"), "database unavailable"])(
        "reports unknown watchdog values after a statistics error %s",
        async (cause) => {
            const em = mockEntityManager()
            em.query.mockRejectedValue(cause)
            const logger = mock<Logger>()
            const service = await build(em, { error: logger.error })

            await expect(service.watchdog()).resolves.toEqual(UNKNOWN_WATCHDOG)
            expect(logger.error).toHaveBeenCalledWith(JobOpsLogEvent.WatchdogUnavailable, cause)
            expect(logger.error).toHaveBeenCalledTimes(1)
        },
    )
})
