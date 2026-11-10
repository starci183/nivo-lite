import { mockEntityManager } from "@starci/jest-preset"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { isThreadDeadlinePayload, threadDeadlineKey } from "./thread-deadline.contracts"
import type { ThreadDeadlinePayload } from "./thread-deadline.contracts"
import { ThreadDeadlineQueue } from "./thread-deadline.queue"

const PAYLOAD: ThreadDeadlinePayload = { workspaceId: "ws-1", runId: "run-1", stepKey: "match", repeats: 1, answered: 0 }

describe("ThreadDeadlineQueue.arm", () => {
    it("writes one delayed fire job keyed by the stop as it stood, in the caller's transaction", async () => {
        const outbox = jobRecordingOutbox()
        const queue = new ThreadDeadlineQueue(outbox)

        await expect(queue.arm(PAYLOAD, 86_400_000, mockEntityManager())).resolves.toBe(true)

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
        await expect(new ThreadDeadlineQueue().arm(PAYLOAD, 10, mockEntityManager())).resolves.toBe(false)

        expect(outbox.written.map((job) => job.delayMs)).toEqual([undefined])
    })
})

describe("thread-deadline contracts", () => {
    it("reads a fire payload back and keys a later state of the stop apart", () => {
        expect(isThreadDeadlinePayload(PAYLOAD)).toBe(true)
        expect(isThreadDeadlinePayload({ ...PAYLOAD, answered: "0" })).toBe(false)
        expect(threadDeadlineKey({ ...PAYLOAD, answered: 1 })).not.toBe(threadDeadlineKey(PAYLOAD))
    })
})
