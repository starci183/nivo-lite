import type {
    OutboxRow,
    JobSnapshot,
    ReceiptRow,
    TickRow,
    WebhookJobRow,
    WebhookMessageRow,
    ObservedMessage,
    ObservedMessageRow,
} from "../fixtures/persistence/proof.rows"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { metaInboxEntities } from "@modules/domain/meta-inbox"
import { jobsEntities } from "@modules/platform/jobs"
import type { LiteWorld } from "./lite-world.service"
import { removeAuthUsers, removeWorkspace } from "./proof-accounts.service"
import { receiptsOf, removeReceipts } from "./receipts-database.service"

const [JobEntity, JobOutboxEntity] = jobsEntities
const [MetaInboxEntity] = metaInboxEntities

/** One outbox row as the entity reads it. */
type OutboxRecord = InstanceType<typeof JobOutboxEntity>

/** The most outbox rows one proof read takes; the proofs seed a handful. */
const OUTBOX_ROWS_MAX = 1000

/** The queue the content tick publishes to. */
const CONTENT_TICK_QUEUE = "content_tick"

/** The publication identity and handoff state of an outbox row. */
const publicationOf = (row: OutboxRecord): WebhookJobRow => ({
    id: row.id,
    payload: row.payload,
    dedupe_key: row.dedupeKey,
    sent_at: row.sentAt,
})

/** The broker-bound envelope the relay publishes from an outbox row. */
const envelopeOf = (row: OutboxRecord): ObservedMessage => ({
    name: row.name,
    payload: row.payload,
    dedupe: row.dedupeKey,
    outbox_id: row.id,
})

/** The outbox rows of one queue whose payload names `deliveryId`. */
const deliveryRows = (manager: EntityManager, queue: string, deliveryId: string): Promise<Array<OutboxRecord>> =>
    manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .where("o.queue = :queue AND o.payload->>'deliveryId' = :deliveryId", { queue, deliveryId })
        .take(OUTBOX_ROWS_MAX)
        .getMany()

/** The durable publications one delivery committed to `queue`. */
export const deliveryPublications = async (
    manager: EntityManager,
    queue: string,
    deliveryId: string,
): Promise<Array<WebhookJobRow>> => (await deliveryRows(manager, queue, deliveryId)).map(publicationOf)

/** The broker-bound envelopes one delivery committed to `queue`, reconstructed from the outbox. */
export const deliveryEnvelopes = async (
    manager: EntityManager,
    queue: string,
    deliveryId: string,
): Promise<Array<WebhookMessageRow>> =>
    (await deliveryRows(manager, queue, deliveryId)).map((row) => ({ message: envelopeOf(row) }))

/** Removes only the outbox rows one delivery committed to `queue`. */
export const removeDeliveryOutbox = async (
    manager: EntityManager,
    queue: string,
    deliveryId: string,
): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .delete()
        .where("queue = :queue AND payload->>'deliveryId' = :deliveryId", { queue, deliveryId })
        .execute()
}

/** Removes the reconcile rows a workspace's booked credit left, before the credit is deleted. */
export const removeCreditOutbox = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .delete()
        .where("queue = 'bank_credit_received' AND payload->>'workspaceId' = :workspaceId", { workspaceId })
        .execute()
}

/** Hides the committed content ticks no relay has sent yet, so a proof sees only its own. */
export const hideOpenTicks = async (manager: EntityManager): Promise<void> => {
    await manager.update(JobOutboxEntity, { queue: CONTENT_TICK_QUEUE, sentAt: IsNull() }, { sentAt: new Date() })
}

/** The unsent content ticks, oldest first. */
export const openTicks = async (manager: EntityManager): Promise<Array<TickRow>> => {
    const rows = await manager.find(JobOutboxEntity, {
        where: { queue: CONTENT_TICK_QUEUE, sentAt: IsNull() },
        order: { createdAt: "ASC" },
        take: OUTBOX_ROWS_MAX,
    })
    return rows.map((row) => ({ id: row.id, queue: row.queue, name: row.name, payload: row.payload }))
}

/** The outbox rows the content tick published for one isolated proof. */
const proofTicks = (manager: EntityManager, proof: string): Promise<Array<OutboxRecord>> =>
    manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .where("o.queue = :queue AND o.payload->>'proofId' = :proof", { queue: CONTENT_TICK_QUEUE, proof })
        .take(OUTBOX_ROWS_MAX)
        .getMany()

/** The outbox rows of a Meta event: its inbound job and its delivery job. */
const webhookRows = (manager: EntityManager, mid: string): Promise<Array<OutboxRecord>> =>
    manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .where(
            "(o.queue = 'meta_inbound' AND o.payload->'event'->>'mid' = :mid) " +
                "OR (o.queue = 'meta-delivery' AND o.payload->>'deliveryId' = :mid)",
            { mid },
        )
        .take(OUTBOX_ROWS_MAX)
        .getMany()

/** Removes the outbox rows of a Meta event, and the delivery rows its stored receipt names. */
const removeWebhookOutbox = async (manager: EntityManager, mid: string): Promise<void> => {
    const receipts = await manager
        .createQueryBuilder(MetaInboxEntity, "i")
        .select("i.deliveryId", "deliveryId")
        .where("i.payload->'entry'->0->'messaging'->0->'message'->>'mid' = :mid", { mid })
        .take(OUTBOX_ROWS_MAX)
        .getRawMany<{ deliveryId: string }>()
    const deliveryIds = receipts.map((row) => row.deliveryId)
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .delete()
        .where("queue = 'meta_inbound' AND payload->'event'->>'mid' = :mid", { mid })
        .execute()
    if (deliveryIds.length === 0) return
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .delete()
        .where("queue = 'meta-delivery' AND payload->>'deliveryId' IN (:...deliveryIds)", { deliveryIds })
        .execute()
}

/** Removes the content ticks one isolated proof published. */
const removeProofTicks = async (manager: EntityManager, proof: string): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .delete()
        .where("queue = :queue AND payload->>'proofId' = :proof", { queue: CONTENT_TICK_QUEUE, proof })
        .execute()
}

/** Reads committed state through the world's observer connection, including while a business transaction is open. */
export const observeQueue = async (world: LiteWorld, proof: string) => ({
    outbox: await outboxRows(world.db.primary, proof),
    messages: await messages(world.db.primary, proof),
})
/** Finds producer rows for one isolated queue proof. */
export const outboxRows = async (manager: EntityManager, proof: string): Promise<Array<OutboxRow>> =>
    (await proofTicks(manager, proof)).map((row) => ({ id: row.id, sent_at: row.sentAt }))
/** Finds the broker-bound envelopes paired with one proof payload, reconstructed from the outbox. */
export const messages = async (manager: EntityManager, proof: string): Promise<Array<ObservedMessageRow>> =>
    (await proofTicks(manager, proof)).map((row) => ({ id: row.id, attempt: row.attempts, message: envelopeOf(row) }))
/** Reads the persisted lease, token and progress of one delivery. */
export const jobSnapshot = async (manager: EntityManager, key: string): Promise<JobSnapshot | undefined> => {
    const job = await manager.findOne(JobEntity, { where: { jobKey: key } })
    if (job === null) return undefined
    return {
        id: job.id,
        status: job.status,
        fencing_token: String(job.fencingToken),
        current_step: job.currentStep,
        error: job.error,
    }
}
/** Removes only this suite's claim rows after its proofs finish. */
export const cleanupJobs = async (manager: EntityManager, prefix: string): Promise<void> => {
    await manager
        .createQueryBuilder(JobEntity, "t")
        .delete()
        .where("starts_with(job_key, :prefix)", { prefix })
        .execute()
}
/** Finds the durable claim for one signed provider body. */
export const receipts = (manager: EntityManager, id: string): Promise<ReadonlyArray<ReceiptRow>> =>
    receiptsOf(manager, "meta", id)
/** Finds the work published by one provider event. */
export const webhookJobs = async (manager: EntityManager, id: string): Promise<Array<WebhookJobRow>> =>
    (await webhookRows(manager, id)).map(publicationOf)
/** Reads the actual queue handoff of one provider event. */
export const webhookMessages = async (manager: EntityManager, id: string): Promise<Array<WebhookMessageRow>> =>
    (await webhookRows(manager, id)).map((row) => ({ message: envelopeOf(row) }))
/** Registers deletion of one provider delivery and its queue effects. */
export const cleanupWebhook = (world: LiteWorld, mid: string, id: string): void =>
    world.cleanup(async () => {
        await removeWebhookOutbox(world.db.primary, mid)
        await removeReceipts(world.db.primary, "meta", id)
    })
/** Registers deletion of one isolated producer handoff. */
export const cleanupQueue = (world: LiteWorld, proof: string): void =>
    world.cleanup(async () => {
        await removeProofTicks(world.db.primary, proof)
    })

/** Registers removal of the owner/workspace created by a persisting webhook builder. */
export const cleanupWorkspace = (world: LiteWorld, user: string, workspace: string): void =>
    world.cleanup(async () => {
        await removeWorkspace(world.db.primary, workspace)
        await removeAuthUsers(world.db.primary, [user])
    })
