import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { bankFeedInboxEntities } from "@modules/domain/bank-feed-inbox"
import { inboundEventsEntities } from "@modules/domain/inbound-events"
import { inboxEntities } from "@modules/platform/inbox"
import { jobsEntities } from "@modules/platform/jobs"

const [BankFeedInboxEntity] = bankFeedInboxEntities
const [InboxEntity] = inboxEntities
const [JobEntity, JobOutboxEntity] = jobsEntities
const [InboundEventEntity] = inboundEventsEntities

/** The bank-feed receipts of one connection are the queue rows whose delivery id starts with the connection id. */
const FEED_OUTBOX_FILTER = "o.queue = 'bank-feed-delivery' AND starts_with(o.payload->>'deliveryId', :connectionId)"

/** The same filter for a delete, which carries no alias. */
const FEED_OUTBOX_DELETE_FILTER = "queue = 'bank-feed-delivery' AND starts_with(payload->>'deliveryId', :connectionId)"

/** One queued job as the outbox holds it. */
export interface OutboxJob {
    readonly id: string
    readonly queue: string
    readonly name: string
    readonly payload: object
}

/** The queued bank-feed receipts of one connection, oldest first. */
export const feedDeliveries = async (manager: EntityManager, connectionId: string): Promise<Array<OutboxJob>> => {
    const rows = await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .where(FEED_OUTBOX_FILTER, { connectionId })
        .select(["o.id", "o.queue", "o.name", "o.payload"])
        .orderBy("o.createdAt")
        .addOrderBy("o.id")
        .getMany()
    return rows.map(({ id, queue, name, payload }) => ({ id, queue, name, payload }))
}

/** Removes the claims the accounting reactor made for the bank credits of a workspace, before the workspace goes. */
export const cleanEventClaims = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    const credits = manager
        .createQueryBuilder(InboundEventEntity, "e")
        .select("e.id::text")
        .where("e.workspace_id = :workspaceId")
        .getQuery()
    await manager
        .createQueryBuilder(InboxEntity, "t")
        .delete()
        .where(`source = 'bank_credit_booked__accounting' AND delivery_id IN (${credits})`, { workspaceId })
        .execute()
}

/** Removes the bank-feed receipts of one connection and their queue rows, which no workspace owns. */
export const cleanFeedReceipts = async (manager: EntityManager, connectionId: string): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .delete()
        .where(FEED_OUTBOX_DELETE_FILTER, { connectionId })
        .execute()
    await manager
        .createQueryBuilder(BankFeedInboxEntity, "t")
        .delete()
        .where("starts_with(delivery_id, :connectionId)", { connectionId })
        .execute()
}

/** Removes the claims the scenario's queue deliveries left, keyed by their outbox row ids. */
export const cleanJobKeys = async (manager: EntityManager, jobKeys: ReadonlyArray<string>): Promise<void> => {
    await manager.delete(JobEntity, { jobKey: In([...jobKeys]) })
}
