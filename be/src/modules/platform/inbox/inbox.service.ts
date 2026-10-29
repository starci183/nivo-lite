import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EntityInbox, InboxEntityReceipt, InboxReceipt } from "./inbox.port"
import { InboxEntity } from "./persistence/entities"

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
            return this.won(result.raw)
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
        return this.won(result.raw)
    }

    /** Whether the insert returned a row: `ON CONFLICT DO NOTHING` returns none for a repeat. */
    private won(raw: unknown): boolean {
        return Array.isArray(raw) && raw.length > 0
    }
}
