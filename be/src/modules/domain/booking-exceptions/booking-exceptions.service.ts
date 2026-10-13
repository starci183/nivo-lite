import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingExceptionCreateParams, BookingExceptionSaved } from "./booking-exceptions.contracts"
import { DELETE_SETUP_EXCEPTION, INSERT_SETUP_EXCEPTION } from "./persistence/booking-exceptions.sql"

@Injectable()
/** Owns booking calendar exceptions after the coordinator proves workspace and resource ownership. */
export class BookingExceptionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Creates a validated exception in the coordinator's resource-ownership transaction. */
    create(
        params: BookingExceptionCreateParams,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingExceptionSaved>> {
        return manager.query<Array<BookingExceptionSaved>>(INSERT_SETUP_EXCEPTION, [
            params.workspaceId,
            params.resourceId,
            params.date,
            params.closed,
            params.start,
            params.end,
            params.note,
        ])
    }

    /** Removes an exception only from the selected workspace and returns its identity. */
    remove(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingExceptionSaved>> {
        return manager.query<Array<BookingExceptionSaved>>(DELETE_SETUP_EXCEPTION, [workspaceId, id])
    }
}
