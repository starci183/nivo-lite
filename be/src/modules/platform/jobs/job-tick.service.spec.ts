import { SchedulerRegistry } from "@nestjs/schedule"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { JobsErrorCode } from "./errors/jobs.error"
import { JOB_TICKS } from "./job-ticks.contracts"
import type { JobTick } from "./job-ticks.contracts"
import { JOB_TICK_SCHEDULER, JOBS_MANAGERS } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import { JobsModule, cronSchedulerOf } from "./jobs.module"
import type { JobTickScheduler } from "./jobs.port"
import { JobTickService, tickMinute } from "./job-tick.service"
import { HASH_STATEMENT, advisoryLockAnswers } from "@tests/fixtures/builders/advisory-lock.builder"

const CLAIM_TICK = 'SELECT * FROM "public"."job_tick_claim"($1, $2)'

const AT = "2026-02-03T04:05:06.000Z"
const TICK: JobTick = {
    name: "nightly-digest",
    cron: "0 2 * * *",
    timeZone: "UTC",
    queue: "digests",
    job: "digest.nightly",
    payload: { kind: "nightly" },
}

const build = async (claimed: boolean | null) => {
    const transaction = fakeTransaction(
        mockEntityManager({
            query: [...advisoryLockAnswers, [CLAIM_TICK, claimed === null ? [] : [{ claimed }]]],
        }),
    )
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const scheduler = mock<JobTickScheduler>()
    const managers = [transaction.em]
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobTickService,
            { provide: JOB_TICK_SCHEDULER, useValue: scheduler },
            { provide: JOBS_MANAGERS, useValue: managers },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { ticks: moduleRef.get(JobTickService), transaction, outbox, write, scheduler, managers, logger }
}

describe("JobTickService", () => {
    it("names a slot of a tick by its UTC minute", () => {
        expect(tickMinute(new Date(AT))).toBe("2026-02-03T04:05")
    })

    it("locks the tick, claims its minute and enqueues one job in the same transaction", async () => {
        const { ticks, transaction, outbox, write } = await build(true)

        await expect(ticks.fire(TICK)).resolves.toBe(true)

        expect(transaction.em.query).toHaveBeenNthCalledWith(1, HASH_STATEMENT, ["tick:nightly-digest", 0])
        expect(transaction.em.query).toHaveBeenNthCalledWith(3, CLAIM_TICK, ["nightly-digest", "2026-02-03T04:05"])
        expect(outbox.jobs).toEqual([{ queue: "digests", payload: { kind: "nightly" } }])
        expect(outbox.allInTransaction).toBe(true)
        expect(write).toHaveBeenCalledWith(
            expect.anything(),
            "digests",
            { kind: "nightly" },
            {
                job: "digest.nightly",
                dedupeKey: "tick:nightly-digest:2026-02-03T04:05",
            },
        )
    })

    it("enqueues nothing when another replica already fired the tick this minute", async () => {
        const { ticks, outbox } = await build(false)

        await expect(ticks.fire(TICK)).resolves.toBe(false)

        expect(outbox.jobs).toHaveLength(0)
    })

    it("enqueues nothing when the database answers no claim", async () => {
        const { ticks, outbox } = await build(null)

        await expect(ticks.fire(TICK)).resolves.toBe(false)

        expect(outbox.jobs).toHaveLength(0)
    })

    it("refuses to fire without a connection that holds the tick table", async () => {
        const { ticks, outbox, managers } = await build(true)
        managers.splice(0)

        await expect(ticks.fire(TICK)).rejects.toMatchObject({ code: JobsErrorCode.ConnectionMissing })

        expect(outbox.jobs).toHaveLength(0)
    })

    it("registers one cron job per tick under the name of the tick", async () => {
        const { ticks, scheduler } = await build(true)

        ticks.onApplicationBootstrap()

        expect(scheduler.schedule.mock.calls.map(([tick]) => tick.name)).toEqual(JOB_TICKS.map((tick) => tick.name))
    })

    it("enqueues the job of the tick when its cron job fires", async () => {
        const { ticks, outbox, scheduler, logger } = await build(true)
        ticks.onApplicationBootstrap()
        const [, onTick] = scheduler.schedule.mock.calls[0] ?? []

        await expect(onTick?.()).resolves.toBeUndefined()

        expect(outbox.jobs).toEqual([{ queue: JOB_TICKS[0]?.queue, payload: JOB_TICKS[0]?.payload }])
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs a failed firing by the name of the tick", async () => {
        const { ticks, logger, scheduler } = await build(true)
        const cause = new Error("redis down")
        ticks.onApplicationBootstrap()
        const [, , onError] = scheduler.schedule.mock.calls[0] ?? []

        onError?.(cause)

        expect(logger.error).toHaveBeenCalledWith(JobsLogEvent.TickFailed, cause, { tick: JOB_TICKS[0]?.name })
    })
})

describe("JOB_TICKS", () => {
    it("holds the 15 ticks, each with a unique name and a five-field UTC cron expression", () => {
        expect(JOB_TICKS).toHaveLength(15)
        expect(new Set(JOB_TICKS.map((tick) => tick.name)).size).toBe(15)
        for (const tick of JOB_TICKS) {
            expect(tick.timeZone).toBe("UTC")
            expect(tick.cron.split(" ")).toHaveLength(5)
        }
    })
})

describe("cronSchedulerOf", () => {
    it("adds a started cron job named after the tick and runs the tick on its firing", async () => {
        const registry = mock<SchedulerRegistry>()
        const onTick = jest.fn(() => Promise.resolve())

        cronSchedulerOf(registry).schedule(TICK, onTick, jest.fn())
        const [name, job] = registry.addCronJob.mock.calls[0] ?? []
        await job?.fireOnTick()
        void job?.stop()

        expect(name).toBe(TICK.name)
        expect(job?.isActive).toBe(false)
        expect(onTick).toHaveBeenCalledTimes(1)
    })

    it("hands a failed firing to the error handler", async () => {
        const registry = mock<SchedulerRegistry>()
        const cause = new Error("redis down")
        const onError = jest.fn()

        cronSchedulerOf(registry).schedule(TICK, () => Promise.reject(cause), onError)
        const [, job] = registry.addCronJob.mock.calls[0] ?? []
        await job?.fireOnTick()
        void job?.stop()

        expect(onError).toHaveBeenCalledWith(cause)
    })
})

describe("JobsModule gate", () => {
    it("composes the tick service and the schedule module when enabled", () => {
        const module = JobsModule.register({
            connection: "c",
            workerId: "w",
            leaseMs: 1,
            scheduler: { enabled: true },
        })

        expect(module.providers).toContain(JobTickService)
        expect(module.imports ?? []).toHaveLength(1)
    })

    it("registers nothing when disabled", () => {
        const module = JobsModule.register({
            connection: "c",
            workerId: "w",
            leaseMs: 1,
            scheduler: { enabled: false },
        })

        expect(module.providers).not.toContain(JobTickService)
        expect(module.imports ?? []).toHaveLength(0)
    })
})
