import type { EntityManager } from "typeorm"
import { accountDataEntities, scopedDeliveryIdOf } from "@modules/domain/account-data"
import { sepayTransactionsEntities } from "@modules/domain/sepay-transactions"
import type { ReceiptRow } from "../fixtures/persistence/proof.rows"

const [AccountDataEntity] = accountDataEntities
const [SepayTransactionEntity] = sepayTransactionsEntities

/** The providers whose durable receipt a delivery proof observes. */
export type ReceiptProvider = "meta" | "telegram" | "zalo" | "sepay"

/** The chat doors whose receipt is the event row of the connection's account. */
type AccountReceiptProvider = Exclude<ReceiptProvider, "sepay">

/** The account data type each chat door's receipt is a row of. */
const EVENT_TYPE_OF: Readonly<Record<AccountReceiptProvider, string>> = {
    meta: "meta.event",
    telegram: "telegram.update",
    zalo: "zalo_oa.event",
}

/** The most receipts one proof delivery can own (a delivery id is unique per provider). */
const RECEIPTS_MAX = 10

/** The receipt columns of a SePay transaction row and of an account row (its value as the payload). */
interface StoredReceipt {
    /** The receipt id. */
    readonly id: string
    /** The provider body as received. */
    readonly payload: object
    /** When the receipt was processed, or null while it is pending. */
    readonly processedAt: Date | null
}

/** The receipt columns the delivery proofs assert, in the proofs' row shape. */
const receiptOf = (row: StoredReceipt): ReceiptRow => ({
    id: row.id,
    payload: row.payload,
    processed_at: row.processedAt,
})

/** The key of one account receipt row. */
interface AccountReceiptKey {
    /** The event type of the door: the partition. */
    readonly type: string
    /** The connection the delivery arrived on. */
    readonly connectionId: string
    /** The provider's id of the delivery: the row key. */
    readonly key: string
}

/** The key of the account row a connection-scoped delivery id names; null for an id of another form (no account row). */
const accountWhereOf = (provider: AccountReceiptProvider, deliveryId: string): AccountReceiptKey | null => {
    const scoped = scopedDeliveryIdOf(deliveryId)
    if (scoped === null) return null
    return { type: EVENT_TYPE_OF[provider], connectionId: scoped.connectionId, key: scoped.externalId }
}

/** The account receipt of one delivery: the event row of its connection under the provider's id, its value as the receipt payload. */
const accountReceiptsOf = async (
    manager: EntityManager,
    provider: AccountReceiptProvider,
    deliveryId: string,
): Promise<ReadonlyArray<ReceiptRow>> => {
    const where = accountWhereOf(provider, deliveryId)
    if (where === null) return []
    const rows = await manager.find(AccountDataEntity, { where, take: RECEIPTS_MAX })
    return rows.map((row) => receiptOf({ id: row.id, payload: row.value, processedAt: row.processedAt }))
}

/**
 * The committed receipts of one delivery of `provider`: a chat door's receipt is the event row (`telegram.update`, `zalo_oa.event`,
 * `meta.event`) of its connection's account, the delivery id without its `<connection>:` prefix being the row key. A SePay receipt is its
 * transaction row.
 */
export const receiptsOf = async (
    manager: EntityManager,
    provider: ReceiptProvider,
    deliveryId: string,
): Promise<ReadonlyArray<ReceiptRow>> => {
    if (provider === "sepay") {
        const rows = await manager.find(SepayTransactionEntity, {
            where: { sepayId: Number(deliveryId) },
            take: RECEIPTS_MAX,
        })
        return rows.map((row) => receiptOf(row))
    }
    return accountReceiptsOf(manager, provider, deliveryId)
}

/** Removes the durable receipt one proof delivery of `provider` created: the account row under its id. */
export const removeReceipts = async (
    manager: EntityManager,
    provider: ReceiptProvider,
    deliveryId: string,
): Promise<void> => {
    if (provider === "sepay") {
        await manager.delete(SepayTransactionEntity, { sepayId: Number(deliveryId) })
        return
    }
    const account = accountWhereOf(provider, deliveryId)
    if (account !== null) await manager.delete(AccountDataEntity, account)
}
