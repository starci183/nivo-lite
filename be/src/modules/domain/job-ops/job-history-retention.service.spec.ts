import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { JobHistoryRetentionService } from "./job-history-retention.service"

/** The statement `callDbFunction` sends for the sweep function. */
const SWEEP_SYSTEM_HISTORY = "SELECT * FROM public.system_history_sweep($1, $2, $3)"

const counts = (outbox: number, jobs = 0, cron = 0, http = 0) => [
    { system_history_sweep: { outbox, jobs, cron, http } },
]

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [JobHistoryRetentionService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(JobHistoryRetentionService)
}

describe("JobHistoryRetentionService", () => {
    it("sweeps with the payload window and stops after the first short batch", async () => {
        const em = mockEntityManager()
        em.query.mockResolvedValueOnce(counts(3, 2, 1, 0))
        const beforeBatch = jest.fn().mockResolvedValue(undefined)
        const deleted = await (await build(em)).sweep({ doneDays: 2, failedDays: 9, batch: 10 }, beforeBatch)
        expect(deleted).toBe(6)
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(SWEEP_SYSTEM_HISTORY, [2, 9, 10])
        expect(beforeBatch).toHaveBeenCalledTimes(1)
    })

    it("keeps batching while any table comes back full, asking the fence before each batch", async () => {
        const em = mockEntityManager()
        em.query
            .mockResolvedValueOnce(counts(5000, 5000, 0, 0))
            .mockResolvedValueOnce(counts(10, 5000, 0, 0))
            .mockResolvedValueOnce(counts(0, 7, 0, 0))
        const beforeBatch = jest.fn().mockResolvedValue(undefined)
        const deleted = await (await build(em)).sweep({}, beforeBatch)
        expect(deleted).toBe(15_017)
        expect(em.query).toHaveBeenCalledTimes(3)
        expect(em.query).toHaveBeenCalledWith(SWEEP_SYSTEM_HISTORY, [1, 7, 5000])
        expect(beforeBatch).toHaveBeenCalledTimes(3)
    })

    it("deletes nothing when the sweep function answers no row", async () => {
        const em = mockEntityManager()
        em.query.mockResolvedValueOnce([])
        const deleted = await (await build(em)).sweep({}, () => Promise.resolve())
        expect(deleted).toBe(0)
        expect(em.query).toHaveBeenCalledTimes(1)
    })

    it("runs no batch once the fence rejects", async () => {
        const em = mockEntityManager()
        const beforeBatch = jest.fn().mockRejectedValue(new Error("fenced out"))
        await expect((await build(em)).sweep({}, beforeBatch)).rejects.toThrow("fenced out")
        expect(em.query).not.toHaveBeenCalled()
    })

    it("stops when the pass spends its batch budget", async () => {
        const em = mockEntityManager()
        em.query.mockResolvedValue(counts(5000))
        const deleted = await (await build(em)).sweep({}, () => Promise.resolve())
        expect(em.query).toHaveBeenCalledTimes(200)
        expect(deleted).toBe(1_000_000)
    })
})
