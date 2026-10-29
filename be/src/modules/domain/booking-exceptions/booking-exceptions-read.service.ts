import { Injectable } from "@nestjs/common"
import { MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingExceptionRecord, OptionalFromDate } from "./booking-exceptions-read.contracts"
import { BookingExceptionEntity } from "./persistence/entities"

/** The most exceptions a workspace lists. */
const LIST_LIMIT = 1000

@Injectable()
/** Calendar exception reads for the capabilities that plan or show the calendar. */
export class BookingExceptionsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The exceptions of a workspace in date order, from a local date when one is given, at most 1000. */
    list(workspaceId: string, from: OptionalFromDate): Promise<ReadonlyArray<BookingExceptionRecord>> {
        return this.entityManager.find(BookingExceptionEntity, {
            where: from === null ? { workspaceId } : { workspaceId, onDate: MoreThanOrEqual(from) },
            order: { onDate: "ASC", id: "ASC" },
            take: LIST_LIMIT,
        })
    }
}
