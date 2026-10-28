import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { JobOpsErrorCode } from "./errors/job-ops.error"
import { JOB_TICKS } from "./job-tick.policy"
import { JobTickService } from "./job-tick.service"

const EXPECTED = [
    ["accounting-desk-morning", "accounting_desk", "accounting_desk.morning", {}, 1440],
    ["agents-sync-all", "agents", "agents.sync", {}, 5],
    ["automation-tick", "automation", "automation.tick", {}, 1],
    ["connection-health-tick", "connection_health", "connection_health", { silentAfterHours: 72 }, 15],
    ["content-tick", "content_tick", "content_tick", {}, 15],
    ["data-sync-tick", "data_sync", "data_sync", { tick: true }, 1],
    ["decisions-drain-work", "decisions", "decisions.drain-work", {}, 1],
    ["marketing-tick", "marketing_tick", "marketing_tick", {}, 15],
    ["realtime-retention-tick", "realtime_retention", "realtime_retention", { tick: true }, 1],
    ["shifts-tick", "shifts_alerts", "shifts.tick", { kind: "tick" }, 1],
    [
        "system-history-retention",
        "system_history_retention",
        "system_history_retention",
        { doneDays: 1, failedDays: 7, batch: 5000 },
        1440,
    ],
    ["zalo-refresh-tick", "zalo_refresh", "zalo_refresh", { withinMs: 25_200_000 }, 360],
] as const

const clock = new FakeClock("2027-01-15T08:00:00.000Z")

const build = async (em: MockEntityManager) => {
    const outbox = recordingQueueOutbox()
    const producer: QueueOutbox = outbox
    const write = jest.spyOn(producer, "write")
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobTickService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { ticks: moduleRef.get(JobTickService), outbox, write }
}

describe("JobTickService", () => {
    afterEach(() => jest.restoreAllMocks())

    it("exposes exactly the migration job ids", () => {
        expect(Object.keys(JOB_TICKS).sort()).toEqual(EXPECTED.map(([id]) => id).sort())
    })

    it.each(EXPECTED)(
        "sends one %s tick with the migration queue, name and payload",
        async (id, queue, job, payload, minutes) => {
            const tx = fakeTransaction(mockEntityManager())
            jest.spyOn(clock, "now").mockReturnValue(new Date(1_800_000_000_000))
            const { ticks, outbox, write } = await build(tx.em)
            await ticks.tick(id)
            expect(outbox.allInTransaction).toBe(true)
            expect(outbox.jobs).toEqual([{ queue, payload }])
            expect(tx.commits).toBe(1)
            expect(write).toHaveBeenCalledTimes(1)
            expect(write).toHaveBeenCalledWith(expect.any(Object), queue, payload, {
                job,
                dedupeKey: `jobs.tick:${id}:${Math.floor(clock.now().getTime() / (minutes * 60_000))}`,
            })
        },
    )

    it.each(["", "unknown", "toString", "__proto__", "constructor", "content-tick ", " content-tick"])(
        "rejects invalid id %j before accessing the database",
        async (id) => {
            const em = mockEntityManager()
            const { ticks, outbox, write } = await build(em)
            await expect(ticks.tick(id)).rejects.toMatchObject({
                code: JobOpsErrorCode.TickIdInvalid,
            })
            expect(outbox.jobs).toEqual([])
            expect(em.transaction).not.toHaveBeenCalled()
            expect(write).not.toHaveBeenCalled()
        },
    )

    it("uses the same atomic dedupe key for retries and a new key in the next cadence window", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { ticks, write } = await build(tx.em)
        jest.spyOn(clock, "now")
            .mockReturnValueOnce(new Date(60_000))
            .mockReturnValueOnce(new Date(119_999))
            .mockReturnValueOnce(new Date(120_000))
        await ticks.tick("automation-tick")
        await ticks.tick("automation-tick")
        await ticks.tick("automation-tick")
        expect(write.mock.calls.map((call) => call[3]?.dedupeKey)).toEqual([
            "jobs.tick:automation-tick:1",
            "jobs.tick:automation-tick:1",
            "jobs.tick:automation-tick:2",
        ])
    })

    it("rolls back and propagates a producer failure", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { ticks, outbox } = await build(tx.em)
        const failure = new Error("queue unavailable")
        outbox.failNext("write", failure)
        await expect(ticks.tick("shifts-tick")).rejects.toBe(failure)
        expect(tx.commits).toBe(0)
    })
})
