import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingOpeningWindow } from "./booking-hours.contracts"
import { DELETE_SETUP_HOURS, INSERT_SETUP_DEFAULT_HOURS, INSERT_SETUP_HOURS } from "./persistence/booking-hours.sql"

@Injectable()
/** Owns weekly opening windows and joins the transaction that proves resource ownership. */
export class BookingHoursService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Opens a new resource Monday through Saturday in its creation transaction. */
    async defaults(
        workspaceId: string,
        resourceId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.query(INSERT_SETUP_DEFAULT_HOURS, [workspaceId, resourceId])
    }

    /** Replaces a resource's validated weekly windows inside the coordinator transaction. */
    async replace(
        workspaceId: string,
        resourceId: string,
        rows: ReadonlyArray<BookingOpeningWindow>,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.query(DELETE_SETUP_HOURS, [workspaceId, resourceId])
        if (rows.length === 0) return
        await manager.query(INSERT_SETUP_HOURS, [
            workspaceId,
            resourceId,
            rows.map((row) => row.weekday),
            rows.map((row) => row.start),
            rows.map((row) => row.end),
        ])
    }
}
