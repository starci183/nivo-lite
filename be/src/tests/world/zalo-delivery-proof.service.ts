import {
    type JobClaims,
    type JobProcessorRegistry,
    type FencedProcessor,
    type ClaimedJob,
    type AdvanceWrite,
    JOB_CLAIMS,
    JOB_PROCESSOR_REGISTRY,
    JobsModule,
} from "@modules/platform/jobs"
import assert from "node:assert/strict"
import { ZaloWebhookGateService } from "@modules/domain/channels"
import { ZaloInboxService } from "@modules/domain/zalo-inbox"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX, type QueueOutbox, type QueueWriteOptions } from "@modules/platform/queue"
import { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
import { ZaloDeliveryQueue, type ZaloDeliveryRecorded } from "../../modules/queues/zalo-delivery/zalo-delivery.queue"
import { ZaloDeliveryProcessor } from "../../features/jobs/zalo-delivery/transport/queue/zalo-delivery.processor"
import { ZaloDeliveryQueueModule } from "../../features/jobs/zalo-delivery/transport/queue/zalo-delivery-queue.module"
import type { LiteWorld } from "./lite-world.service"
import { QUEUE_MODULES } from "./test-capabilities.options"
import { RECEIPT_DOMAIN_MODULES } from "./receipt-domain-proof.module"
import { cleanupWorkspace, deliveryEnvelopes, deliveryPublications, removeDeliveryOutbox } from "./proof-database.service"
import { persistReceiptAccount } from "../fixtures/builders/account-data.builder"
import { receiptsOf, removeReceipts } from "./receipts-database.service"
import type { DynamicModule } from "@nestjs/common"
import type { ReceiptRow, WebhookJobRow, WebhookMessageRow } from "@tests/fixtures/persistence/proof.rows"
import type { EntityManager } from "typeorm"

/** Real database, queue, claims and receipt owners shared by the delivery proofs. */
export const RECEIPT_DELIVERY_MODULES: Array<DynamicModule> = [
    ...QUEUE_MODULES,
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "proof",
        leaseMs: 1000,
        scheduler: { enabled: false },
    }),
    ...RECEIPT_DOMAIN_MODULES,
]

type ZaloDeliveryStateResultShape = {
    receipts: ReadonlyArray<ReceiptRow>
    jobs: Array<WebhookJobRow>
    messages: Array<WebhookMessageRow>
}

/** Observes the committed receipt and its durable outbox handoff. */
export const zaloDeliveryState = async (
    world: LiteWorld,
    deliveryId: string,
): Promise<ZaloDeliveryStateResultShape> => ({
    receipts: await receiptsOf(world.db.primary, "zalo", deliveryId),
    jobs: await deliveryPublications(world.db.primary, ZALO_DELIVERY_QUEUE, deliveryId),
    messages: await deliveryEnvelopes(world.db.primary, ZALO_DELIVERY_QUEUE, deliveryId),
})

type ZaloPublicationBuilderResultOutboxShape = {
    write: jest.SpyInstance<
        Promise<void>,
        [tx: EntityManager, queue: string, payload: object, options?: QueueWriteOptions | undefined]
    >
}

type ZaloPublicationBuilderResultMessageShape = {
    deliveryId: string
}

type ZaloPublicationBuilderResultShape = {
    message: ZaloPublicationBuilderResultMessageShape
    queue: ZaloDeliveryQueue
    service: ZaloInboxService
    outbox: ZaloPublicationBuilderResultOutboxShape
}

/** Isolates a real producer and registers cleanup before publication can occur. */
export const zaloPublicationBuilder = (world: LiteWorld): ZaloPublicationBuilderResultShape => {
    const message = { deliveryId: `${world.id()}:m-1` }
    world.cleanup(async () => {
        await removeDeliveryOutbox(world.db.primary, ZALO_DELIVERY_QUEUE, message.deliveryId)
        await removeReceipts(world.db.primary, "zalo", message.deliveryId)
    })
    const actual = world.resolve<QueueOutbox>(QUEUE_OUTBOX)
    // The connection of a delivery proof holds no OA secret key, and a call to such a connection is closed unread: the proof is about the
    // road after the gate, so the gate is told the key is held.
    jest.spyOn(world.resolve(ZaloWebhookGateService), "holdsProofKey").mockResolvedValue(true)
    return {
        message,
        queue: world.resolve(ZaloDeliveryQueue),
        service: world.resolve(ZaloInboxService),
        outbox: { write: jest.spyOn(actual, "write") },
    }
}

type ZaloDeliveryBuilderResultClaimsShape = {
    advance: jest.SpyInstance<Promise<void>, [write: AdvanceWrite]>
}

type ZaloDeliveryBuilderResultInboxShape = {
    processRecordedDelivery: jest.SpyInstance<Promise<void>, [message: ZaloDeliveryRecorded]>
}

type ZaloDeliveryBuilderResultShape = {
    processor: ZaloDeliveryProcessor
    job: ClaimedJob
    jobKey: string
    message: ZaloPublicationBuilderResultMessageShape
    inbox: ZaloDeliveryBuilderResultInboxShape
    claims: ZaloDeliveryBuilderResultClaimsShape
    advance: (write: AdvanceWrite) => Promise<void>
}

/** The text message m-1 of user-1 every Zalo delivery proof receives, as the `raw` of its `zalo_oa.event` row keeps it. */
export const ZALO_PROOF_EVENT = {
    app_id: "app-1",
    event_name: "user_send_text",
    sender: { id: "user-1" },
    message: { msg_id: "m-1", text: "Hello" },
}

/** The text message as the webhook posts it. */
export const ZALO_PROOF_BODY: Buffer = Buffer.from(JSON.stringify(ZALO_PROOF_EVENT))

/**
 * Persists the owner, the workspace and the live Zalo OA connection a delivery resolves at receipt (a connection nobody holds keeps
 * nothing); removing the workspace removes the connection and its account rows.
 */
export const persistZaloAccount = async (world: LiteWorld, connection: string): Promise<void> => {
    const userId = world.id()
    const workspaceId = world.id()
    cleanupWorkspace(world, userId, workspaceId)
    await persistReceiptAccount(world.db.primary, { userId, workspaceId, connectionId: connection, provider: "zalo_oa" })
}

/** Persists a committed receipt and a third live fence using the real claim service. */
export const zaloDeliveryBuilder = async (world: LiteWorld): Promise<ZaloDeliveryBuilderResultShape> => {
    const publication = zaloPublicationBuilder(world)
    const connection = publication.message.deliveryId.split(":")[0]
    assert(connection !== undefined)
    await persistZaloAccount(world, connection)
    await publication.service.acceptZaloDelivery(ZALO_PROOF_BODY, connection)
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

type RegisterZaloDeliveryResultRegistryShape = {
    add: jest.SpyInstance<void, [processor: FencedProcessor]>
}

type RegisterZaloDeliveryResultShape = {
    registry: RegisterZaloDeliveryResultRegistryShape
    processor: ZaloDeliveryProcessor
}

/** Observes registration while running the composed module's real initialization hook. */
export const registerZaloDelivery = (world: LiteWorld): RegisterZaloDeliveryResultShape => {
    const registry = world.resolve<JobProcessorRegistry>(JOB_PROCESSOR_REGISTRY)
    const add = jest.spyOn(registry, "add")
    world.resolve(ZaloDeliveryQueueModule).onModuleInit()
    return { registry: { add }, processor: world.resolve(ZaloDeliveryProcessor) }
}
