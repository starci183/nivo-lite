import { Test } from "@nestjs/testing"
import { mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { REPLAY_TTL_MS, SWEEP_BATCH, SWEEP_MAX_BATCHES } from "./realtime.contracts"
import { REALTIME_MANAGERS } from "./realtime.decorators"
import { RealtimeRetentionService } from "./realtime-retention.service"
import { RealtimeEventEntity } from "./persistence/entities"

/** How many rows a batch deleted; undefined is a statement that answers no count. */
type Deleted = number | undefined

/** A manager whose delete answers the counts in order (the only count answers every batch). */
const build = async (...answers: Array<Deleted>) => {
    const em = mockEntityManager()
    const batches = answers.map((affected) => ({ execute: { affected, raw: [] } }))
    const queued = batches.length === 1 ? Array.from({ length: SWEEP_MAX_BATCHES }, () => batches[0] ?? {}) : batches
    const fakes = queueQueryBuilders(em, queued)
    const managers = [em]
    const moduleRef = await Test.createTestingModule({
        providers: [RealtimeRetentionService, { provide: REALTIME_MANAGERS, useValue: managers }],
    }).compile()
    return { retention: moduleRef.get(RealtimeRetentionService), em, fakes }
}

const fenced = () => jest.fn(() => Promise.resolve())

describe("RealtimeRetentionService.sweep", () => {
    it("deletes the frames older than the replay window and answers how many it deleted", async () => {
        const { retention, em, fakes } = await build(2)
        const beforeBatch = fenced()

        await expect(retention.sweep(beforeBatch)).resolves.toBe(2)

        const [batch] = fakes
        expect(em.createQueryBuilder).toHaveBeenCalledWith(RealtimeEventEntity, "r")
        expect(batch?.callsOf("delete")).toEqual([[]])
        expect(batch?.callsOf("where")).toEqual([
            [
                "seq IN (SELECT old.seq FROM public.realtime_events old " +
                    "WHERE old.created_at < now() - make_interval(secs => CAST(:ttl AS double precision) / 1000) " +
                    "ORDER BY old.seq LIMIT :batch)",
                { ttl: REPLAY_TTL_MS, batch: SWEEP_BATCH },
            ],
        ])
        expect(beforeBatch).toHaveBeenCalledTimes(1)
    })

    it("answers zero when the statement answers no count, so a repeated pass changes nothing", async () => {
        const { retention } = await build(undefined)

        await expect(retention.sweep(fenced())).resolves.toBe(0)
    })

    it("keeps deleting while a batch comes back full, and asks the fence before every batch", async () => {
        const { retention, em } = await build(SWEEP_BATCH, SWEEP_BATCH, 400)
        const beforeBatch = fenced()

        await expect(retention.sweep(beforeBatch)).resolves.toBe(SWEEP_BATCH * 2 + 400)

        expect(em.createQueryBuilder).toHaveBeenCalledTimes(3)
        expect(beforeBatch).toHaveBeenCalledTimes(3)
    })

    it("stops at the batch budget of a pass when the table stays full, and leaves the rest to the next pass", async () => {
        const { retention, em } = await build(SWEEP_BATCH)

        await expect(retention.sweep(fenced())).resolves.toBe(SWEEP_BATCH * SWEEP_MAX_BATCHES)

        expect(em.createQueryBuilder).toHaveBeenCalledTimes(SWEEP_MAX_BATCHES)
    })

    it("deletes nothing when the fence refuses a batch", async () => {
        const { retention, em } = await build(2)

        await expect(retention.sweep(() => Promise.reject(new Error("fenced out")))).rejects.toThrow("fenced out")

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a sweep on an app that composed no connection for the realtime tables", async () => {
        const managers: Array<ReturnType<typeof mockEntityManager>> = []
        const moduleRef = await Test.createTestingModule({
            providers: [RealtimeRetentionService, { provide: REALTIME_MANAGERS, useValue: managers }],
        }).compile()

        await expect(moduleRef.get(RealtimeRetentionService).sweep(fenced())).rejects.toThrow(
            "REALTIME_CONNECTION_MISSING",
        )
    })
})
