import { In, type EntityManager } from "typeorm"
import { accountDataEntities } from "@modules/domain/account-data"
import { jobsEntities } from "@modules/platform/jobs"

const [AccountDataEntity] = accountDataEntities
const [JobEntity, JobOutboxEntity] = jobsEntities

/** The bank-feed receipts of one connection are the queue rows whose delivery id starts with the connection id. */
const FEED_OUTBOX_FILTER = "o.queue = 'bank-feed-delivery' AND starts_with(o.payload->>'deliveryId', :connectionId)"

/** The same filter for a delete, which carries no alias. */
const FEED_OUTBOX_DELETE_FILTER = "queue = 'bank-feed-delivery' AND starts_with(payload->>'deliveryId', :connectionId)"

/** The most receipts one proof reads; a scenario delivers a handful. */
const RECEIPTS_MAX = 100

/** One row of a bank-feed connection's account a proof reads back. */
export interface FeedReceiptRow {
    /** The row. */
    readonly id: string
    /** Its key: the provider's own id. */
    readonly key: string
    /** What the row holds, exactly as written. */
    readonly value: object
    /** When the booking finished it, or null while it is pending. */
    readonly processedAt: Date | null
}

/** One queue row a proof reads back. */
export interface OutboxJob {
    /** The outbox row. */
    readonly id: string
    /** The queue it belongs to. */
    readonly queue: string
    /** The job name. */
    readonly name: string
    /** The payload the producer wrote. */
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

/** The rows of one type the account of one connection keeps (`sepay.delivery`, `sepay.transaction`, ...), oldest first. */
export const feedRows = async (
    manager: EntityManager,
    connectionId: string,
    type: string,
): Promise<Array<FeedReceiptRow>> => {
    const rows = await manager.find(AccountDataEntity, {
        where: { type, connectionId },
        order: { occurredAt: "ASC", id: "ASC" },
        take: RECEIPTS_MAX,
    })
    return rows.map(({ id, key, value, processedAt }) => ({ id, key, value, processedAt }))
}

/** Removes the bank-feed queue rows of one connection, which no workspace owns, and every row its account keeps. */
export const cleanFeedReceipts = async (manager: EntityManager, connectionId: string): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .delete()
        .where(FEED_OUTBOX_DELETE_FILTER, { connectionId })
        .execute()
    await manager.delete(AccountDataEntity, { connectionId })
}

/** Removes the claims the scenario's queue deliveries left, keyed by their outbox row ids. */
export const cleanJobKeys = async (manager: EntityManager, jobKeys: ReadonlyArray<string>): Promise<void> => {
    await manager.delete(JobEntity, { jobKey: In([...jobKeys]) })
}
