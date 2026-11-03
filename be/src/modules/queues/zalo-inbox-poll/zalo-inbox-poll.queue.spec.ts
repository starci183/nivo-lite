import { mock } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { QueueOutbox } from "@modules/platform/queue"
import {
    RECONCILE_ZALO_INBOX_JOB,
    ZALO_INBOX_POLL_QUEUE,
    ZaloInboxPollQueue,
    isZaloInboxPollPayload,
} from "./zalo-inbox-poll.queue"

describe("isZaloInboxPollPayload", () => {
    it.each([
        ["the tick payload", {}],
        ["a payload naming a connection and its workspace", { connectionId: "c-1", workspaceId: "ws-1" }],
    ])("accepts %s", (_name, value) => {
        expect(isZaloInboxPollPayload(value)).toBe(true)
    })

    it.each([
        ["a missing payload", null],
        ["a text", "x"],
        ["a connection without its workspace", { connectionId: "c-1" }],
        ["a workspace without its connection", { workspaceId: "ws-1" }],
        ["an empty id", { connectionId: "", workspaceId: "ws-1" }],
    ])("refuses %s", (_name, value) => {
        expect(isZaloInboxPollPayload(value)).toBe(false)
    })
})

describe("ZaloInboxPollQueue enqueueReconcile", () => {
    it("writes the job in the caller's transaction, one per connection and minute", async () => {
        const outbox = mock<QueueOutbox>()
        const tx = mock<EntityManager>()
        const queue = new ZaloInboxPollQueue(outbox)

        await queue.enqueueReconcile({ connectionId: "c-1", workspaceId: "ws-1" }, new Date("2026-11-04T10:00:30.000Z"), tx)

        expect(outbox.write).toHaveBeenCalledWith(
            tx,
            ZALO_INBOX_POLL_QUEUE,
            { connectionId: "c-1", workspaceId: "ws-1" },
            { job: RECONCILE_ZALO_INBOX_JOB, dedupeKey: `zalo-inbox-poll:c-1:${Date.parse("2026-11-04T10:00:00.000Z") / 60_000}` },
        )
    })
})
