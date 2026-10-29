import { SchedulerRegistry } from "@nestjs/schedule"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { JOB_TICKS } from "./job-ticks.contracts"
import type { JobTick } from "./job-ticks.contracts"
import { JOBS_MANAGERS } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import { JobsModule } from "./jobs.module"
import { JobTickService, tickMinute } from "./job-tick.service"

// The statements advisoryXactLock and callDbFunction of platform/database send for one firing.
const LOCK_TICK = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"
const CLAIM_TICK = "SELECT * FROM public.job_tick_claim($1, $2)"

const AT = "2026-02-03T04:05:06.000Z"
const TICK: JobTick = {
    name: "nightly-digest",
    cron: "0 2 * * *",
    timeZone: "UTC",
    queue: "digests",
    job: "digest.nightly",
    payload: { kind: "nightly" },
}

const build = async (claimed: boolean) => {
    const transaction = fakeTransaction(
        mockEntityManager({
            query: [
                [LOCK_TICK, []],
                [CLAIM_TICK, [{ claimed }]],
            ],
        }),
    )
    const outbox = recordingQueueOutbox()
    const write = jest.spyOn(outbox, "write")
    const registry = mock<SchedulerRegistry>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobTickService,
            { provide: SchedulerRegistry, useValue: registry },
            { provide: JOBS_MANAGERS, useValue: [transaction.em] },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { ticks: moduleRef.get(JobTickService), transaction, outbox, write, registry, logger }
}

describe("JobTickService", () => {
    it("names a slot of a tick by its UTC minute", () => {
        expect(tickMinute(new Date(AT))).toBe("2026-02-03T04:05")
    })

    it("locks the tick, claims its minute and enqueues one job in the same transaction", async () => {
        const { ticks, transaction, outbox, write } = await build(true)

        await expect(ticks.fire(TICK)).resolves.toBe(true)

        expect(transaction.em.query).toHaveBeenNthCalledWith(1, LOCK_TICK, ["tick:nightly-digest"])
        expect(transaction.em.query).toHaveBeenNthCalledWith(2, CLAIM_TICK, ["nightly-digest", "2026-02-03T04:05"])
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

    it("holds the 13 ticks, each with a unique name and a five-field UTC cron expression", () => {
        expect(JOB_TICKS).toHaveLength(13)
        expect(new Set(JOB_TICKS.map((tick) => tick.name)).size).toBe(13)
        for (const tick of JOB_TICKS) {
            expect(tick.timeZone).toBe("UTC")
            expect(tick.cron.split(" ")).toHaveLength(5)
        }
    })

    it("registers one cron job per tick under the name of the tick", async () => {
        const { ticks, registry } = await build(true)

        ticks.onApplicationBootstrap()

        expect(registry.addCronJob.mock.calls.map(([name]) => name)).toEqual(JOB_TICKS.map((tick) => tick.name))
        for (const [, job] of registry.addCronJob.mock.calls) void job.stop()
    })

    it("logs a failed firing by the name of the tick and does not throw", async () => {
        const { ticks, outbox, logger, registry } = await build(true)
        const cause = new Error("redis down")
        outbox.failNext("write", cause)
        ticks.onApplicationBootstrap()
        const [, first] = registry.addCronJob.mock.calls[0] ?? []

        await expect(first?.fireOnTick()).resolves.toBeUndefined()
        await new Promise((resolve) => setImmediate(resolve))
        for (const [, job] of registry.addCronJob.mock.calls) void job.stop()

        expect(logger.error).toHaveBeenCalledWith(JobsLogEvent.TickFailed, cause, { tick: JOB_TICKS[0]?.name })
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
