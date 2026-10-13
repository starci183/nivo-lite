import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import {
    DATA_SYNC_QUEUE,
    DATA_SYNC_SCHEDULER,
    DataSyncQueue,
    isDataSyncPayload,
    isDataSyncTickPayload,
} from "./data-sync.queue"

const payload = { workspaceId: "ws-1", connectionId: "conn-1", runId: "run-1" }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [DataSyncQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(DataSyncQueue), outbox }
}

describe("DataSyncQueue", () => {
    it("writes one sync keyed on the run", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueSync(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, DATA_SYNC_QUEUE, payload, { dedupeKey: "data_sync:run-1" })
    })

    it("ticks every minute", () => {
        expect(DATA_SYNC_SCHEDULER).toEqual({
            queue: DATA_SYNC_QUEUE,
            id: "data-sync-tick",
            everyMs: 60_000,
            payload: { tick: true },
        })
    })
})

describe("data sync payloads", () => {
    it("accepts a sync and a tick and refuses the rest", () => {
        expect(isDataSyncPayload(payload)).toBe(true)
        expect(isDataSyncPayload(null)).toBe(false)
        expect(isDataSyncPayload({ runId: "run-1", workspaceId: "ws-1" })).toBe(false)
        expect(isDataSyncPayload({ ...payload, connectionId: 1 })).toBe(false)
        expect(isDataSyncPayload({ ...payload, runId: 1 })).toBe(false)
        expect(isDataSyncPayload({ ...payload, workspaceId: 1 })).toBe(false)
        expect(isDataSyncTickPayload({ tick: true })).toBe(true)
        expect(isDataSyncTickPayload({ tick: false })).toBe(false)
        expect(isDataSyncTickPayload(null)).toBe(false)
        expect(isDataSyncTickPayload({})).toBe(false)
    })
})
