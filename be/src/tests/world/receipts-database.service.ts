import type { EntityManager } from "typeorm"
import { metaInboxEntities } from "@modules/domain/meta-inbox"
import { sepayTransactionsEntities } from "@modules/domain/sepay-transactions"
import { telegramInboxEntities } from "@modules/domain/telegram-inbox"
import { zaloInboxEntities } from "@modules/domain/zalo-inbox"
import type { ReceiptRow } from "../fixtures/persistence/proof.rows"

const [MetaInboxEntity] = metaInboxEntities
const [SepayTransactionEntity] = sepayTransactionsEntities
const [TelegramInboxEntity] = telegramInboxEntities
const [ZaloInboxEntity] = zaloInboxEntities

/** The providers whose durable receipt a delivery proof observes. */
export type ReceiptProvider = "meta" | "telegram" | "zalo" | "sepay"

/** The most receipts one proof delivery can own (a delivery id is unique per provider). */
const RECEIPTS_MAX = 10

/** The receipt columns every provider's inbox entity carries. */
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

/** The committed receipts of one delivery of `provider`, read through the owning capability's entity. */
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
        return rows.map(receiptOf)
    }
    if (provider === "meta") {
        const rows = await manager.find(MetaInboxEntity, { where: { provider, deliveryId }, take: RECEIPTS_MAX })
        return rows.map(receiptOf)
    }
    const where = { provider, deliveryId }
    if (provider === "telegram")
        return (await manager.find(TelegramInboxEntity, { where, take: RECEIPTS_MAX })).map(receiptOf)
    return (await manager.find(ZaloInboxEntity, { where, take: RECEIPTS_MAX })).map(receiptOf)
}

/** Removes the durable receipt one proof delivery of `provider` created. */
export const removeReceipts = async (
    manager: EntityManager,
    provider: ReceiptProvider,
    deliveryId: string,
): Promise<void> => {
    if (provider === "sepay") {
        await manager.delete(SepayTransactionEntity, { sepayId: Number(deliveryId) })
        return
    }
    if (provider === "meta") await manager.delete(MetaInboxEntity, { provider, deliveryId })
    if (provider === "telegram") await manager.delete(TelegramInboxEntity, { provider, deliveryId })
    if (provider === "zalo") await manager.delete(ZaloInboxEntity, { provider, deliveryId })
}
