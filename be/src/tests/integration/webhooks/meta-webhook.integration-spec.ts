import { META_CLIENT } from "@modules/integrations/meta"
import type { MetaClient } from "@modules/integrations/meta"
import { createHmac } from "node:crypto"
import { META_INBOUND_QUEUE } from "@modules/domain/meta-inbox"
import { META_DELIVERY_QUEUE } from "@modules/queues/meta-delivery"
import { webhooksBuilder } from "../../fixtures/builders/webhooks.builder"
import {
    receipts,
    webhookJobs,
    webhookMessages,
    cleanupWebhook,
    cleanupWorkspace,
} from "../../world/proof-database.service"
import { useTestWorld } from "../../world/use-test-world"
import type { LiteWorld } from "../../world/lite-world.service"
import { WEBHOOK_MODULES, signingFixture } from "../../world/test-capabilities.options"
type WebhookFixture = Awaited<ReturnType<ReturnType<typeof webhooksBuilder>["build"]>>

/** A Jest type matcher as an untyped value, so it can stand in a typed expectation. */
const anyOf = (type: unknown): unknown => expect.any(type)

/** A Jest object matcher as an untyped value, so it can stand in a typed expectation. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const registerSignatureProof = (world: LiteWorld, fixture: () => WebhookFixture) => {
    it("webhooks/bad-signature-is-refused: a signature for different bytes cannot claim or enqueue", async () => {
        const { door, connections, close } = await fixture().build()
        world.cleanup(close)
        const sent = fixture().delivery()
        cleanupWebhook(world, sent.mid, sent.deliveryId)
        const signature = `sha256=${createHmac("sha256", signingFixture).update("{}").digest("hex")}`
        await expect(door.receive(sent.rawBody, signature)).rejects.toMatchObject({
            code: fixture().signatureInvalidCode,
        })
        expect(connections.findLiveByMeta).not.toHaveBeenCalled()
        expect(await receipts(world.db.primary, sent.deliveryId)).toEqual([])
        expect(await webhookJobs(world.db.primary, sent.mid)).toEqual([])
        expect(await webhookMessages(world.db.primary, sent.mid)).toEqual([])
    })
}

const registerReplayProof = (world: LiteWorld, fixture: () => WebhookFixture) => {
    it("webhooks/replay-is-refused: a repeated signed body is acknowledged without repeated effects", async () => {
        // Meta signs only the raw body, with no timestamp replay window; the durable body hash rejects repeated work.
        const { door, connections, threads, process, close } = await fixture().build()
        world.cleanup(close)
        const sent = fixture().delivery()
        cleanupWebhook(world, sent.mid, sent.deliveryId)
        await door.receive(sent.rawBody, sent.signature)
        const before = await receipts(world.db.primary, sent.deliveryId)
        const receiptJobs = await webhookJobs(world.db.primary, sent.deliveryId)
        expect(receiptJobs).toHaveLength(1)
        expect(before[0]?.processed_at).toBeNull()
        expect(connections.recordEvent).not.toHaveBeenCalled()
        await process(sent.deliveryId)
        const completed = await receipts(world.db.primary, sent.deliveryId)
        const queued = await webhookJobs(world.db.primary, sent.mid)
        expect(before).toHaveLength(1)
        expect(queued).toHaveLength(1)
        await expect(door.receive(sent.rawBody, sent.signature)).resolves.toBeUndefined()
        expect(await receipts(world.db.primary, sent.deliveryId)).toEqual(completed)
        expect(await webhookJobs(world.db.primary, sent.deliveryId)).toEqual(receiptJobs)
        await process(sent.deliveryId)
        expect(await receipts(world.db.primary, sent.deliveryId)).toEqual(completed)
        expect(await webhookJobs(world.db.primary, sent.mid)).toEqual(queued)
        expect(await webhookMessages(world.db.primary, sent.mid)).toHaveLength(1)
        expect(connections.recordEvent).toHaveBeenCalledTimes(1)
        expect(threads.touch).toHaveBeenCalledTimes(1)
    })
}

const assertDownstreamDelivery = async (
    world: LiteWorld,
    fixture: WebhookFixture,
    sent: ReturnType<WebhookFixture["delivery"]>,
): Promise<void> => {
    const queued = await webhookJobs(world.db.primary, sent.mid)
    expect(queued).toHaveLength(1)
    const [job] = queued
    expect(job).toEqual({
        id: anyOf(String),
        payload: {
            connectionId: fixture.connectionId,
            workspaceId: fixture.workspaceId,
            event: objectLike({
                event_key: `dm:${sent.mid}`,
                mid: sent.mid,
                text: "Integration delivery",
            }),
        },
        dedupe_key: `${META_INBOUND_QUEUE}:${fixture.connectionId}:dm:${sent.mid}`,
        sent_at: null,
    })
    expect(await webhookMessages(world.db.primary, sent.mid)).toEqual([
        {
            message: {
                name: META_INBOUND_QUEUE,
                payload: job?.payload,
                dedupe: job?.dedupe_key,
                outbox_id: job?.id,
            },
        },
    ])
}

const registerHandoffProof = (world: LiteWorld, fixture: () => WebhookFixture) => {
    it("webhooks/accepted-delivery-publishes-once: concurrent redeliveries commit one receipt and job", async () => {
        const { door, connections, conversations, taker, process, close } = await fixture().build()
        world.cleanup(close)
        const sent = fixture().delivery()
        cleanupWebhook(world, sent.mid, sent.deliveryId)
        await Promise.all([door.receive(sent.rawBody, sent.signature), door.receive(sent.rawBody, sent.signature)])
        const recorded = await receipts(world.db.primary, sent.deliveryId)
        expect(recorded).toEqual([
            {
                id: anyOf(String),
                payload: sent.payload,
                processed_at: null,
            },
        ])
        const receiptJobs = await webhookJobs(world.db.primary, sent.deliveryId)
        expect(receiptJobs).toEqual([
            {
                id: anyOf(String),
                payload: { deliveryId: sent.deliveryId },
                dedupe_key: `${META_DELIVERY_QUEUE}:${sent.deliveryId}`,
                sent_at: null,
            },
        ])
        expect(await webhookMessages(world.db.primary, sent.deliveryId)).toEqual([
            {
                message: {
                    name: META_DELIVERY_QUEUE,
                    payload: { deliveryId: sent.deliveryId },
                    dedupe: `${META_DELIVERY_QUEUE}:${sent.deliveryId}`,
                    outbox_id: receiptJobs[0]?.id,
                },
            },
        ])
        expect(connections.recordEvent).not.toHaveBeenCalled()
        expect(await webhookJobs(world.db.primary, sent.mid)).toEqual([])
        expect(await webhookMessages(world.db.primary, sent.mid)).toEqual([])
        await Promise.all([process(sent.deliveryId), process(sent.deliveryId)])
        expect(await receipts(world.db.primary, sent.deliveryId)).toEqual([
            { ...recorded[0], processed_at: anyOf(Date) },
        ])
        await assertDownstreamDelivery(world, fixture(), sent)
        expect(connections.recordEvent).toHaveBeenCalledTimes(1)
        expect(conversations.acceptMeta).not.toHaveBeenCalled()
        expect(taker.take).not.toHaveBeenCalled()
    })
}

describe("NIVO Meta webhook (local Supabase integration)", () => {
    const world = useTestWorld({ modules: [...WEBHOOK_MODULES] })
    let fixture: WebhookFixture
    beforeAll(async () => {
        const userId = world.id()
        const workspaceId = world.id()
        fixture = await webhooksBuilder(world.db.primary, world.resolve<MetaClient>(META_CLIENT), {
            userId,
            workspaceId,
            connectionId: world.id(),
            signingFixture,
            nextId: () => world.id(),
        }).build()
        cleanupWorkspace(world, userId, workspaceId)
    })
    registerSignatureProof(world, () => fixture)
    registerReplayProof(world, () => fixture)
    registerHandoffProof(world, () => fixture)
})
