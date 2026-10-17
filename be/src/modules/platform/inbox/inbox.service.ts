import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { Inbox, InboxReceipt } from "./inbox.port"
import { INSERT_INBOX_CLAIM } from "./persistence/inbox.sql"

@Injectable()
/** Claims delivery keys durably; provider receipts share their caller's outbox transaction. */
export class InboxService implements Inbox {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Only the winning insert may publish a receipt; a repeat returns false. */
    async claim(source: string, eventId: string, manager?: EntityManager, receipt?: InboxReceipt): Promise<boolean> {
        if (source === "" || eventId.trim() === "") return false
        if (manager === undefined) {
            if (receipt !== undefined) return false
            const rows = await this.entityManager.query<Array<{ readonly delivery_id: string }>>(INSERT_INBOX_CLAIM, [
                source,
                eventId,
            ])
            return rows.length > 0
        }
        if (receipt === undefined) return false
        const rows = await manager.query<Array<{ readonly id: string }>>(receipt.insert, [
            source,
            eventId,
            JSON.stringify(receipt.payload),
        ])
        return rows.length > 0
    }
}
