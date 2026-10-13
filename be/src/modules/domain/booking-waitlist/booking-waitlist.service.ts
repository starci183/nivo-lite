import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingWaitlistIdRow } from "./persistence/booking-waitlist.rows"
import { CANCEL_SETUP_WAITLIST, JOIN_WAITLIST } from "./persistence/booking-waitlist.sql"
import type { WaitlistEntry } from "./booking-waitlist.contracts"

@Injectable()
/** Owns waitlist status writes and joins the transaction supplied by its caller. */
export class BookingWaitlistService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Cancels a workspace-owned entry without deleting its waitlist history. */
    cancel(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingWaitlistIdRow>> {
        return manager.query<Array<BookingWaitlistIdRow>>(CANCEL_SETUP_WAITLIST, [workspaceId, id])
    }

    /** Puts a customer on the waiting line of a service for a window; true when this call added the entry. */
    async join(entry: WaitlistEntry): Promise<boolean> {
        const rows = await this.entityManager.query<Array<BookingWaitlistIdRow>>(JOIN_WAITLIST, [
            entry.workspaceId,
            entry.leadId,
            entry.conversationId,
            entry.customerName.trim().slice(0, 120),
            entry.customerPhone,
            entry.serviceId,
            entry.windowStart,
            entry.windowEnd,
            Math.max(1, Math.min(200, Math.round(entry.partySize))),
            entry.note.trim().slice(0, 400),
        ])
        return rows.length > 0
    }
}
