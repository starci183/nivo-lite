import { builder } from "@starci/jest-preset"
import { QueryRunnerProviderAlreadyReleasedError } from "typeorm"
import {
    GENERIC_WEBHOOK_QUEUE,
    GenericWebhookJob,
    GenericWebhookQueue,
    genericWebhookKey,
    type GenericWebhookPayload,
} from "@modules/queues/generic-webhook"
import { useTestWorld } from "@tests/world/use-test-world"
import { GenericWebhookIntakeService } from "@modules/domain/agent-inbound"
import { persistReceiptAccount } from "@tests/fixtures/builders/account-data.builder"
import {
    GENERIC_WEBHOOK_INTAKE_MODULES,
    GENERIC_WEBHOOK_QUEUE_MODULES,
    observeCommittedWebhookDelivery,
    releasedTransactionOf,
    webhookAccountReceipts,
} from "@tests/world/generic-webhook-queue-proof.service"
import {
    cleanupWorkspace,
    deliveryEnvelopes,
    deliveryPublications,
    removeDeliveryOutbox,
} from "@tests/world/proof-database.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const payloadOf = builder<GenericWebhookPayload>({
    connectionId: "endpoint-1",
    deliveryId: "endpoint-1:receipt-1",
    rawBody: '{"type":"payment.received","id":"receipt-1"}',
    eventType: "payment.received",
    deliveryKey: "receipt-1",
})

describe("GenericWebhookQueue", () => {
    const world = useTestWorld({ modules: [...GENERIC_WEBHOOK_QUEUE_MODULES] })
    const givenDelivery = (label: string) => {
        const payload = payloadOf({ deliveryId: world.key(label) })
        world.cleanup(() => removeDeliveryOutbox(world.db.primary, GENERIC_WEBHOOK_QUEUE, payload.deliveryId))
        return payload
    }

    it("writes the receipt job and stable delivery identity using the caller's transaction", async () => {
        const queue = world.resolve(GenericWebhookQueue)
        const payload = givenDelivery("committed")
        await world.db.primary.transaction(async (tx) => {
            await queue.enqueueDeliver(payload, tx)
            const rows = await deliveryPublications(tx, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)
            expect(rows).toHaveLength(1)
            expect(rows.map(({ payload: stored, dedupe_key }) => ({ payload: stored, dedupe_key }))).toEqual([
                { payload, dedupe_key: genericWebhookKey(payload.deliveryId) },
            ])
            expect(await deliveryEnvelopes(tx, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)).toEqual([
                {
                    message: {
                        name: GenericWebhookJob.Deliver,
                        payload,
                        dedupe: genericWebhookKey(payload.deliveryId),
                        outbox_id: rows[0]?.id,
                    },
                },
            ])
            expect(await observeCommittedWebhookDelivery(world, payload)).toEqual([])
        })
        expect(await deliveryPublications(world.db.primary, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)).toHaveLength(1)
    })

    it("keeps one durable publication when the same delivery is retried", async () => {
        const queue = world.resolve(GenericWebhookQueue)
        const payload = givenDelivery("replayed")
        const enqueue = () => world.db.primary.transaction((tx) => queue.enqueueDeliver(payload, tx))
        await Promise.all([enqueue(), enqueue()])
        await enqueue()
        const rows = await deliveryPublications(world.db.primary, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)
        expect(rows).toHaveLength(1)
        expect(rows[0]?.payload).toEqual(payload)
        expect(rows[0]?.dedupe_key).toBe(genericWebhookKey(payload.deliveryId))
    })

    it("rolls back the publication with the caller's rejected receipt transaction", async () => {
        const queue = world.resolve(GenericWebhookQueue)
        const payload = givenDelivery("rolled-back")
        const failure = new TestWorldError({ code: TestWorldErrorCode.TransactionRefused })
        await expect(
            world.db.primary.transaction(async (tx) => {
                await queue.enqueueDeliver(payload, tx)
                expect(await deliveryPublications(tx, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)).toHaveLength(1)
                throw failure
            }),
        ).rejects.toBe(failure)
        expect(await deliveryPublications(world.db.primary, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)).toEqual([])
    })

    it("propagates a failed job write and persists no delivery when the caller transaction has closed", async () => {
        const queue = world.resolve(GenericWebhookQueue)
        const payload = givenDelivery("closed-transaction")
        const tx = await releasedTransactionOf(world)
        await expect(queue.enqueueDeliver(payload, tx)).rejects.toEqual(new QueryRunnerProviderAlreadyReleasedError())
        expect(await deliveryPublications(world.db.primary, GENERIC_WEBHOOK_QUEUE, payload.deliveryId)).toEqual([])
    })
})

describe("GenericWebhookIntakeService receipts in the account", () => {
    const world = useTestWorld({ modules: [...GENERIC_WEBHOOK_INTAKE_MODULES] })

    it("a redelivery writes no second account_data row and queues no second job", async () => {
        const userId = world.id()
        const workspaceId = world.id()
        const endpoint = world.id()
        cleanupWorkspace(world, userId, workspaceId)
        await persistReceiptAccount(world.db.primary, { userId, workspaceId, connectionId: endpoint, provider: "webhook" })
        const deliveryId = `${endpoint}:receipt-1`
        world.cleanup(() => removeDeliveryOutbox(world.db.primary, GENERIC_WEBHOOK_QUEUE, deliveryId))
        const delivery = {
            endpoint,
            rawBody: Buffer.from('{"type":"payment.received","id":"receipt-1"}'),
            signature: "proven",
            eventType: undefined,
            deliveryKey: undefined,
        }
        const intake = world.resolve(GenericWebhookIntakeService)
        await intake.accept(delivery)
        await intake.accept(delivery)
        const receipts = await webhookAccountReceipts(world, endpoint)
        expect(receipts).toEqual([
            {
                key: "receipt-1",
                value: { deliveryId: "receipt-1", raw: { type: "payment.received", id: "receipt-1" } },
                processedAt: null,
            },
        ])
        expect(await deliveryPublications(world.db.primary, GENERIC_WEBHOOK_QUEUE, deliveryId)).toHaveLength(1)
    })

    it("a delivery for an endpoint nobody holds keeps no receipt and queues nothing", async () => {
        const endpoint = world.id()
        const deliveryId = `${endpoint}:receipt-1`
        await world.resolve(GenericWebhookIntakeService).accept({
            endpoint,
            rawBody: Buffer.from('{"type":"payment.received","id":"receipt-1"}'),
            signature: "proven",
            eventType: undefined,
            deliveryKey: undefined,
        })
        expect(await webhookAccountReceipts(world, endpoint)).toEqual([])
        expect(await deliveryPublications(world.db.primary, GENERIC_WEBHOOK_QUEUE, deliveryId)).toEqual([])
    })
})
