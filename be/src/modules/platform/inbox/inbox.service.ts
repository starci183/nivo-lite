import { Injectable } from "@nestjs/common"
import type { EntityManager, ObjectLiteral } from "typeorm"
import { DatabaseError, DatabaseErrorCode, returnedRows, rowShape } from "@modules/platform/database"
import type { EntityInbox, InboxEntityReceipt, InboxEventId, InboxReceiptId } from "./inbox.port"
import { InboxEntity } from "./persistence/entities"

/** The row a delivery claim returns to the transaction that won it. */
const isClaimedRow = rowShape({ delivery_id: "string" })

/** The row a receipt insert returns to the transaction that won it. */
const isReceiptRow = rowShape({ id: "string" })

/** The provider's delivery id, trimmed; a missing or blank one is refused before anything is claimed or written. */
const deliveryIdOf = (eventId: InboxEventId): string => {
    const deliveryId = eventId?.trim()
    if (!deliveryId) throw new DatabaseError({ code: DatabaseErrorCode.WebhookDeliveryIdRequired })
    return deliveryId
}

@Injectable()
/** Claims a delivery with the receipt transaction, so a failure can be retried without losing the delivery. */
export class InboxService implements EntityInbox {
    /** The first claim wins; the same source and delivery id becomes a no-op on redelivery. */
    async claim(source: string, eventId: InboxEventId, tx: EntityManager): Promise<boolean> {
        const claimed = await this.claimDelivery(source, deliveryIdOf(eventId), tx)
        return claimed
    }

    /** The claim first; only its winner inserts the receipt row, and a row that already exists is left as it is. */
    async claimRow<Row extends ObjectLiteral>(
        source: string,
        eventId: InboxEventId,
        tx: EntityManager,
        receipt: InboxEntityReceipt<Row>,
    ): Promise<InboxReceiptId> {
        const deliveryId = deliveryIdOf(eventId)
        if (!(await this.claimDelivery(source, deliveryId, tx))) return undefined
        const inserted = await tx
            .createQueryBuilder(receipt.entity, "receipt")
            .insert()
            .values(receipt.row(deliveryId))
            .orIgnore()
            .returning("id")
            .execute()
        return returnedRows(inserted.raw, isReceiptRow)[0]?.id
    }

    /** Claims a normalized delivery id; an answered row means this transaction holds the first claim. */
    private async claimDelivery(source: string, deliveryId: string, tx: EntityManager): Promise<boolean> {
        const inserted = await tx
            .createQueryBuilder(InboxEntity, "i")
            .insert()
            .values({ source, deliveryId })
            .orIgnore()
            .returning("delivery_id")
            .execute()
        return returnedRows(inserted.raw, isClaimedRow).length > 0
    }
}
