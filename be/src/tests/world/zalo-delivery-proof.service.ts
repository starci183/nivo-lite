import assert from "node:assert/strict"
import { ZaloInboxService } from "@modules/domain/zalo-inbox"
import { JOB_CLAIMS, JOB_PROCESSOR_REGISTRY, JobsModule } from "@modules/platform/jobs"
import type { JobClaims, JobProcessorRegistry } from "@modules/platform/jobs"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
import { ZaloDeliveryQueue } from "../../modules/queues/zalo-delivery/zalo-delivery.queue"
import { ZaloDeliveryProcessor } from "../../features/jobs/zalo-delivery/transport/queue/zalo-delivery.processor"
import { ZaloDeliveryQueueModule } from "../../features/jobs/zalo-delivery/transport/queue/zalo-delivery-queue.module"
import type { LiteWorld } from "./lite-world.service"
import { QUEUE_MODULES } from "./test-capabilities.options"
import { RECEIPT_DOMAIN_MODULES } from "./receipt-domain-proof.module"
import type { ReceiptRow, WebhookJobRow, WebhookMessageRow } from "../fixtures/persistence/proof.rows"
import * as statements from "../fixtures/builders/zalo-delivery.sql"

/** Real database, queue, claims and receipt owners shared by the delivery proofs. */
export const RECEIPT_DELIVERY_MODULES = [
    ...QUEUE_MODULES,
    JobsModule.register({ isGlobal: true, connection: PRIMARY_ENTITY_MANAGER, workerId: "proof", leaseMs: 1000 }),
    ...RECEIPT_DOMAIN_MODULES,
]

/** Observes the committed receipt and its actual outbox and pgmq handoff. */
export const zaloDeliveryState = async (world: LiteWorld, deliveryId: string) => ({
    receipts: await world.db.primary.query<Array<ReceiptRow>>(statements.RECEIPTS, [deliveryId]),
    jobs: await world.db.primary.query<Array<WebhookJobRow>>(statements.JOBS, [deliveryId]),
    messages: await world.db.primary.query<Array<WebhookMessageRow>>(statements.MESSAGES, [deliveryId]),
})

/** Isolates a real producer and registers cleanup before publication can occur. */
export const zaloPublicationBuilder = (world: LiteWorld) => {
    const message = { deliveryId: `${world.id()}:m-1` }
    world.cleanup(async () => {
        await world.db.primary.query(statements.CLEAN_MESSAGES, [message.deliveryId])
        await world.db.primary.query(statements.CLEAN_JOBS, [message.deliveryId])
        await world.db.primary.query(statements.CLEAN_RECEIPTS, [message.deliveryId])
    })
    const actual = world.resolve<QueueOutbox>(QUEUE_OUTBOX)
    return {
        message,
        queue: world.resolve(ZaloDeliveryQueue),
        service: world.resolve(ZaloInboxService),
        outbox: { write: jest.spyOn(actual, "write") },
    }
}

/** Persists a committed receipt and a third live fence using the real claim service. */
export const zaloDeliveryBuilder = async (world: LiteWorld) => {
    const publication = zaloPublicationBuilder(world)
    const connection = publication.message.deliveryId.split(":")[0]
    assert(connection !== undefined)
    const body = Buffer.from(
        JSON.stringify({
            app_id: "app-1",
            event_name: "user_send_text",
            sender: { id: "user-1" },
            message: { msg_id: "m-1", text: "Hello" },
        }),
    )
    await publication.service.acceptZaloDelivery(body, connection)
    const actual = world.resolve<JobClaims>(JOB_CLAIMS)
    const jobKey = world.key(publication.message.deliveryId)
    const claim = () =>
        actual.claim({
            kind: ZALO_DELIVERY_QUEUE,
            jobKey,
            payload: publication.message,
            workerId: "proof",
            leaseMs: 1000,
        })
    const first = await claim()
    assert(first !== null)
    await actual.fail({ jobId: first.jobId, expectedFencingToken: first.fencingToken, reason: "proof retry" })
    const second = await claim()
    assert(second !== null)
    await actual.fail({ jobId: second.jobId, expectedFencingToken: second.fencingToken, reason: "proof retry" })
    const job = await claim()
    assert(job !== null)
    const advance = actual.advance.bind(actual)
    return {
        processor: world.resolve(ZaloDeliveryProcessor),
        job,
        jobKey,
        message: publication.message,
        inbox: { processRecordedDelivery: jest.spyOn(publication.service, "processRecordedDelivery") },
        claims: { advance: jest.spyOn(actual, "advance") },
        advance,
    }
}

/** Observes registration while running the composed module's real initialization hook. */
export const registerZaloDelivery = (world: LiteWorld) => {
    const registry = world.resolve<JobProcessorRegistry>(JOB_PROCESSOR_REGISTRY)
    const add = jest.spyOn(registry, "add")
    world.resolve(ZaloDeliveryQueueModule).onModuleInit()
    return { registry: { add }, processor: world.resolve(ZaloDeliveryProcessor) }
}
