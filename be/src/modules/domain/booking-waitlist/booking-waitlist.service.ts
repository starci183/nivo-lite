import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingWaitlistIdRow } from "./persistence/booking-waitlist.rows"
import { CANCEL_SETUP_WAITLIST } from "./persistence/booking-waitlist.sql"

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
}
