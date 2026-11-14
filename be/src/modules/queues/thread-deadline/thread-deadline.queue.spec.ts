import { mock, mockEntityManager } from "@starci/jest-preset"
import type { QueueStatusService } from "@modules/platform/queue"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { isThreadDeadlinePayload, threadDeadlineKey } from "./thread-deadline.contracts"
import type { ThreadDeadlinePayload } from "./thread-deadline.contracts"
import { ThreadDeadlineQueue } from "./thread-deadline.queue"

const PAYLOAD: ThreadDeadlinePayload = { workspaceId: "ws-1", runId: "run-1", stepKey: "match", repeats: 1, answered: 0 }

describe("ThreadDeadlineQueue.arm", () => {
    it("writes one delayed fire job keyed by the stop as it stood, in the caller's transaction", async () => {
        const outbox = jobRecordingOutbox()
        const queue = new ThreadDeadlineQueue(outbox)

        await expect(queue.arm(PAYLOAD, 86_400_000, mockEntityManager())).resolves.toBe("written")

        expect(outbox.written).toEqual([
            {
                queue: "thread_deadline",
                payload: PAYLOAD,
                job: "thread-deadline.fire",
                dedupeKey: "thread-deadline:run-1:match:1.0",
                delayMs: 86_400_000,
            },
        ])
    })

    it("writes a deadline already due with no delay, and arms nothing in an app with no outbox", async () => {
        const outbox = jobRecordingOutbox()

        await new ThreadDeadlineQueue(outbox).arm(PAYLOAD, -5, mockEntityManager())
        await expect(new ThreadDeadlineQueue().arm(PAYLOAD, 10, mockEntityManager())).resolves.toBe("unqueued")

        expect(outbox.written.map((job) => job.delayMs)).toEqual([undefined])
    })

    it("writes nothing when the job of the stop as it stood already stands (the minute sweep's re-arm), and says so", async () => {
        const outbox = jobRecordingOutbox()
        const status = mock<QueueStatusService>()
        status.stands.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        const queue = new ThreadDeadlineQueue(outbox, status)
        const tx = mockEntityManager()

        await expect(queue.arm(PAYLOAD, 60_000, tx)).resolves.toBe("written")
        await expect(queue.arm(PAYLOAD, 60_000, tx)).resolves.toBe("standing")

        expect(outbox.written).toHaveLength(1)
        expect(status.stands).toHaveBeenCalledWith(tx, "ws-1", "thread_deadline", "thread-deadline.fire", "thread-deadline:run-1:match:1.0")
    })
})

describe("thread-deadline contracts", () => {
    it("reads a fire payload back and keys a later state of the stop apart", () => {
        expect(isThreadDeadlinePayload(PAYLOAD)).toBe(true)
        expect(isThreadDeadlinePayload({ ...PAYLOAD, answered: "0" })).toBe(false)
        expect(threadDeadlineKey({ ...PAYLOAD, answered: 1 })).not.toBe(threadDeadlineKey(PAYLOAD))
    })
})
