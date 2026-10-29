import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingOpeningWindow } from "./booking-hours.contracts"
import { BookingHourEntity } from "./persistence/entities"

/** The most windows a resource holds in a week. */
const WINDOW_LIMIT = 56

/** The default window: nine to six. */
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5, 6] as const

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
        await manager.insert(
            BookingHourEntity,
            DEFAULT_WEEKDAYS.map((weekday) => ({
                workspaceId,
                resourceId,
                weekday,
                startTime: "09:00",
                endTime: "18:00",
            })),
        )
    }

    /** Replaces a resource's validated weekly windows inside the coordinator transaction. */
    async replace(
        workspaceId: string,
        resourceId: string,
        rows: ReadonlyArray<BookingOpeningWindow>,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.delete(BookingHourEntity, { workspaceId, resourceId })
        if (rows.length === 0) return
        await manager.insert(
            BookingHourEntity,
            rows.slice(0, WINDOW_LIMIT).map((row) => ({
                workspaceId,
                resourceId,
                weekday: row.weekday,
                startTime: row.start,
                endTime: row.end,
            })),
        )
    }
}
