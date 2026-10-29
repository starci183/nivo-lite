import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, returnedRows, rowShape } from "@modules/platform/database"
import type { EntityInbox, InboxEntityReceipt, InboxReceipt } from "./inbox.port"
import { InboxEntity } from "./persistence/entities"

/** The row a delivery claim returns to the transaction that won it. */
const isClaimedRow = rowShape({ delivery_id: "string" })

/** The row a receipt insert returns to the transaction that won it. */
const isReceiptRow = rowShape({ id: "string" })

@Injectable()
/** Claims delivery keys durably; provider receipts share their caller's outbox transaction. */
export class InboxService implements EntityInbox {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Only the winning insert may publish a receipt; a repeat returns false. */
    async claim(source: string, eventId: string, manager?: EntityManager, receipt?: InboxReceipt): Promise<boolean> {
        if (source === "" || eventId.trim() === "") return false
        if (receipt === undefined) {
            const result = await (manager ?? this.entityManager)
                .createQueryBuilder(InboxEntity, "i")
                .insert()
                .values({ source, deliveryId: eventId })
                .orIgnore()
                .returning("delivery_id")
                .execute()
            return returnedRows(result.raw, isClaimedRow).length > 0
        }
        if (manager === undefined) return false
        const rows = await manager.query<Array<{ readonly id: string }>>(receipt.insert, [
            source,
            eventId,
            JSON.stringify(receipt.payload),
        ])
        return rows.length > 0
    }

    /** Only the winning insert may publish a receipt; a repeat returns false. */
    async claimRow(
        source: string,
        eventId: string,
        manager: EntityManager,
        receipt: InboxEntityReceipt,
    ): Promise<boolean> {
        if (source === "" || eventId.trim() === "") return false
        const result = await manager
            .createQueryBuilder(receipt.entity, "e")
            .insert()
            .values(receipt.row)
            .orIgnore()
            .returning("id")
            .execute()
        return returnedRows(result.raw, isReceiptRow).length > 0
    }
}
