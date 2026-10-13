import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { firstBooleanResult } from "@modules/platform/primitives"
import type { BooleanResultRow } from "@modules/platform/primitives"
import type { BookingServiceSaved, BookingServiceWrite } from "./booking-services.contracts"
import {
    DELETE_SERVICE,
    INSERT_SERVICE,
    LOCK_SERVICE,
    RETIRE_SERVICE,
    SELECT_SERVICE_USAGE,
    UPDATE_SERVICE,
} from "./persistence/booking-services.sql"

@Injectable()
/** Owns service catalogue persistence; the caller proves its membership and validates the supplied fields. */
export class BookingServicesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Creates or updates one workspace-owned service, optionally joining the caller's transaction. */
    save(
        params: BookingServiceWrite,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingServiceSaved>> {
        const values = [
            params.workspaceId,
            params.name,
            params.description,
            params.durationMin,
            params.bufferMin,
            params.priceVnd,
            params.resourceKind,
            params.followupDays,
            params.active,
        ]
        return params.id === null
            ? manager.query<Array<BookingServiceSaved>>(INSERT_SERVICE, values)
            : manager.query<Array<BookingServiceSaved>>(UPDATE_SERVICE, [...values, params.id])
    }

    /** Holds the owned service until the removal transaction finishes. */
    lock(workspaceId: string, id: string, manager: EntityManager): Promise<ReadonlyArray<BookingServiceSaved>> {
        return manager.query<Array<BookingServiceSaved>>(LOCK_SERVICE, [workspaceId, id])
    }

    /** Reports whether bookings or waitlist entries still reference the service. */
    used(workspaceId: string, id: string, manager: EntityManager): Promise<boolean> {
        return manager.query<Array<BooleanResultRow>>(SELECT_SERVICE_USAGE, [workspaceId, id]).then(firstBooleanResult)
    }

    /** Removes an unused locked service, or retires it when its history must remain. */
    remove(
        workspaceId: string,
        id: string,
        retire: boolean,
        manager: EntityManager,
    ): Promise<ReadonlyArray<BookingServiceSaved>> {
        return manager.query<Array<BookingServiceSaved>>(retire ? RETIRE_SERVICE : DELETE_SERVICE, [workspaceId, id])
    }
}
