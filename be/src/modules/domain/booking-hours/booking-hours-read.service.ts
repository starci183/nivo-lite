import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingHourRecord } from "./booking-hours-read.contracts"
import { BookingHourEntity } from "./persistence/entities"

/** The most windows a workspace lists. */
const WEEK_LIMIT = 2000

@Injectable()
/** Weekly opening window reads for the capabilities that plan the calendar. */
export class BookingHoursReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The weekly windows of every resource of a workspace, at most 2000. */
    week(workspaceId: string): Promise<ReadonlyArray<BookingHourRecord>> {
        return this.entityManager.find(BookingHourEntity, { where: { workspaceId }, take: WEEK_LIMIT })
    }
}
