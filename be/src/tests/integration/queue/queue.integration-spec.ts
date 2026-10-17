import type { QueueOutbox } from "@modules/platform/queue"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import assert from "node:assert/strict"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { CONTENT_TICK_QUEUE } from "@modules/queues/content-tick"
import { queueBuilder } from "../../fixtures/builders/queue.builder"
import { useTestWorld } from "../../world/use-test-world"
import { QUEUE_MODULES } from "../../world/test-capabilities.options"
import { outboxRows, messages, observeQueue, cleanupQueue } from "../../world/proof-database.service"
import { cronProof } from "../../world/cron-proof.service"

describe("NIVO queue (local Supabase integration)", () => {
    const world = useTestWorld({ modules: [...QUEUE_MODULES] })
    it("queue/enqueue-atomic-with-transaction: outbox and pgmq writes commit or roll back together", async () => {
        const kept = world.key("kept")
        const lost = world.key("lost")
        cleanupQueue(world, kept)
        cleanupQueue(world, lost)
        const keep = queueBuilder(world.resolve<QueueOutbox>(QUEUE_OUTBOX), kept)
        const lose = queueBuilder(world.resolve<QueueOutbox>(QUEUE_OUTBOX), lost)
        await world.db.primary.transaction(async (tx) => {
            await keep.build(tx)
            expect(await outboxRows(tx, kept)).toHaveLength(1)
            expect(await messages(tx, kept)).toHaveLength(1)
            expect(await observeQueue(world, kept)).toEqual({ outbox: [], messages: [] })
        })
        await expect(
            world.db.primary.transaction(async (tx) => {
                await lose.build(tx)
                expect(await outboxRows(tx, lost)).toHaveLength(1)
                expect(await messages(tx, lost)).toHaveLength(1)
                throw new TestWorldError({ code: TestWorldErrorCode.TransactionRefused })
            }),
        ).rejects.toThrow(TestWorldErrorCode.TransactionRefused)
        expect((await observeQueue(world, kept)).outbox).toHaveLength(1)
        expect((await observeQueue(world, kept)).messages).toHaveLength(1)
        expect(await observeQueue(world, lost)).toEqual({ outbox: [], messages: [] })
    })
    it("queue/relay-job-id-is-outbox-id: duplicate writes and deliveries retain one outbox identity", async () => {
        const proofId = world.key("identity")
        const dedupeKey = `${CONTENT_TICK_QUEUE}:${proofId}`
        cleanupQueue(world, proofId)
        const builder = queueBuilder(world.resolve<QueueOutbox>(QUEUE_OUTBOX), proofId)
        const enqueue = () => world.db.primary.transaction((tx) => builder.build(tx, dedupeKey))
        await Promise.all([enqueue(), enqueue()])
        await enqueue()
        const observed = await observeQueue(world, proofId)
        expect(observed.outbox).toHaveLength(1)
        expect(observed.messages).toHaveLength(1)
        const [row] = observed.outbox
        const [message] = observed.messages
        assert(row !== undefined && message !== undefined)
        expect(row.sent_at).toEqual(expect.any(Date))
        expect(message.message).toEqual({
            name: CONTENT_TICK_QUEUE,
            payload: { proofId },
            dedupe: dedupeKey,
            outbox_id: row.id,
        })
        const signal = new AbortController().signal
        expect(builder.delivery(message, signal).id).toBe(row.id)
        expect(builder.delivery({ ...message, attempt: 2 }, signal).id).toBe(row.id)
    })
    it("queue/scheduler-fires-once: the migrated cron tick is enqueued and consumed once", async () => {
        const proof = await cronProof(world)
        expect(proof.jobs).toHaveLength(1)
        expect(proof.jobs[0]?.schedule).toBe("*/15 * * * *")
        expect(proof.jobs[0]?.command).toContain("pgmq.send")
        expect(proof.added).toHaveLength(1)
        expect(proof.deliveries).toHaveLength(1)
        expect(proof.deliveries[0]).toMatchObject({
            id: `content_tick:${proof.added[0]?.id}`,
            job: CONTENT_TICK_QUEUE,
            payload: {},
            attempt: 1,
        })
        expect(proof.remaining.map((row) => row.id)).not.toContain(proof.added[0]?.id)
    })
})
