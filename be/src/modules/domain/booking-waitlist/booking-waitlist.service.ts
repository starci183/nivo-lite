import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingWaitlistSaved, WaitlistEntry } from "./booking-waitlist.contracts"
import { BookingServiceEntity } from "@modules/domain/booking-services"
import { BookingWaitlistEntity } from "./persistence/entities"

@Injectable()
/** Owns waitlist status writes and joins the transaction supplied by its caller. */
export class BookingWaitlistService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Cancels a workspace-owned entry without deleting its waitlist history. */
    async cancel(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingWaitlistSaved>> {
        const cancelled = await manager.update(BookingWaitlistEntity, { workspaceId, id }, { status: "cancelled" })
        return (cancelled.affected ?? 0) > 0 ? [{ id }] : []
    }

    /** Puts a customer on the waiting line of a service for a window; true when this call added the entry. */
    join(entry: WaitlistEntry): Promise<boolean> {
        const windowStart = new Date(entry.windowStart)
        const windowEnd = new Date(entry.windowEnd)
        const same = {
            workspaceId: entry.workspaceId,
            serviceId: entry.serviceId,
            status: "waiting",
            windowStart,
            windowEnd,
        }
        const waiting = [
            ...(entry.conversationId === null ? [] : [{ ...same, conversationId: entry.conversationId }]),
            ...(entry.leadId === null ? [] : [{ ...same, leadId: entry.leadId }]),
        ]
        return this.entityManager.transaction(async (manager) => {
            // Concurrent joins of one service queue on its row, so the check below and the insert never interleave.
            await manager
                .createQueryBuilder(BookingServiceEntity, "s")
                .select("s.id")
                .where("s.id = :serviceId", { serviceId: entry.serviceId })
                .setLock("pessimistic_write")
                .getOne()
            if (waiting.length > 0 && (await manager.exists(BookingWaitlistEntity, { where: waiting }))) return false
            await manager.insert(BookingWaitlistEntity, {
                workspaceId: entry.workspaceId,
                leadId: entry.leadId,
                conversationId: entry.conversationId,
                customerName: entry.customerName.trim().slice(0, 120),
                customerPhone: entry.customerPhone,
                serviceId: entry.serviceId,
                windowStart,
                windowEnd,
                partySize: Math.max(1, Math.min(200, Math.round(entry.partySize))),
                note: entry.note.trim().slice(0, 400),
            })
            return true
        })
    }
}
