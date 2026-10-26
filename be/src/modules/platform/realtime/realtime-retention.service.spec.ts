import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { REPLAY_TTL_MS, SWEEP_BATCH, SWEEP_MAX_BATCHES } from "./realtime.contracts"
import { REALTIME_MANAGERS } from "./realtime.decorators"
import { RealtimeRetentionService } from "./realtime-retention.service"
import { DELETE_EXPIRED_EVENTS } from "./persistence/realtime.sql"

type Count = ReadonlyArray<{ readonly deleted: string }>

const build = async (...answers: Array<Count>) => {
    const em = mockEntityManager({ query: answers.map((answer) => [DELETE_EXPIRED_EVENTS, answer]) })
    const managers = [em]
    const moduleRef = await Test.createTestingModule({
        providers: [RealtimeRetentionService, { provide: REALTIME_MANAGERS, useValue: managers }],
    }).compile()
    return { retention: moduleRef.get(RealtimeRetentionService), em }
}

const fenced = () => jest.fn(() => Promise.resolve())

describe("RealtimeRetentionService.sweep", () => {
    it("deletes the frames older than the replay window and answers how many it deleted", async () => {
        const { retention, em } = await build([{ deleted: "2" }])
        const beforeBatch = fenced()

        await expect(retention.sweep(beforeBatch)).resolves.toBe(2)

        expect(em.query).toHaveBeenCalledWith(DELETE_EXPIRED_EVENTS, [REPLAY_TTL_MS, SWEEP_BATCH])
        expect(beforeBatch).toHaveBeenCalledTimes(1)
    })

    it("answers zero when the statement answers no count, so a repeated pass changes nothing", async () => {
        const { retention } = await build([])

        await expect(retention.sweep(fenced())).resolves.toBe(0)
    })

    it("keeps deleting while a batch comes back full, and asks the fence before every batch", async () => {
        const { retention, em } = await build(
            [{ deleted: String(SWEEP_BATCH) }],
            [{ deleted: String(SWEEP_BATCH) }],
            [{ deleted: "400" }],
        )
        const beforeBatch = fenced()

        await expect(retention.sweep(beforeBatch)).resolves.toBe(SWEEP_BATCH * 2 + 400)

        expect(em.query).toHaveBeenCalledTimes(3)
        expect(beforeBatch).toHaveBeenCalledTimes(3)
    })

    it("stops at the batch budget of a pass when the table stays full, and leaves the rest to the next pass", async () => {
        const { retention, em } = await build([{ deleted: String(SWEEP_BATCH) }])

        await expect(retention.sweep(fenced())).resolves.toBe(SWEEP_BATCH * SWEEP_MAX_BATCHES)

        expect(em.query).toHaveBeenCalledTimes(SWEEP_MAX_BATCHES)
    })

    it("deletes nothing when the fence refuses a batch", async () => {
        const { retention, em } = await build([{ deleted: "2" }])

        await expect(retention.sweep(() => Promise.reject(new Error("fenced out")))).rejects.toThrow("fenced out")

        expect(em.query).not.toHaveBeenCalled()
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
