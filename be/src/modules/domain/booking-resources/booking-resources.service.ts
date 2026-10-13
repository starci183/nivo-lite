import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { firstBooleanResult } from "@modules/platform/primitives"
import type { BooleanResultRow } from "@modules/platform/primitives"
import type { BookingResourceSaved, BookingResourceWrite } from "./booking-resources.contracts"
import {
    DELETE_RESOURCE,
    INSERT_RESOURCE,
    LOCK_RESOURCE,
    LOCK_STAFF,
    RETIRE_RESOURCE,
    SELECT_RESOURCE_USAGE,
    UPDATE_RESOURCE,
} from "./persistence/booking-resources.sql"

@Injectable()
/** Owns resource persistence; callers authorize setup writes and supply their atomic calendar transaction. */
export class BookingResourcesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Saves one resource inside the setup transaction after any staff link has been proven. */
    save(
        params: BookingResourceWrite,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingResourceSaved>> {
        const values = [params.workspaceId, params.name, params.kind, params.capacity, params.active, params.staffId]
        const statement = params.id === null ? INSERT_RESOURCE : UPDATE_RESOURCE
        if (params.id !== null) values.push(params.id)
        return manager.query<Array<BookingResourceSaved>>(statement, values)
    }

    /** Holds the owned resource until its setup transaction finishes. */
    lock(workspaceId: string, id: string, manager: EntityManager): Promise<ReadonlyArray<BookingResourceSaved>> {
        return manager.query<Array<BookingResourceSaved>>(LOCK_RESOURCE, [workspaceId, id])
    }

    /** Proves and holds a staff link within the same workspace as the resource. */
    lockStaff(workspaceId: string, id: string, manager: EntityManager): Promise<ReadonlyArray<BookingResourceSaved>> {
        return manager.query<Array<BookingResourceSaved>>(LOCK_STAFF, [workspaceId, id])
    }

    /** Reports whether booking or waitlist history still references the resource. */
    used(workspaceId: string, id: string, manager: EntityManager): Promise<boolean> {
        return manager.query<Array<BooleanResultRow>>(SELECT_RESOURCE_USAGE, [workspaceId, id]).then(firstBooleanResult)
    }

    /** Deletes an unused locked resource, or retires it when its history must remain. */
    remove(
        workspaceId: string,
        id: string,
        retire: boolean,
        manager: EntityManager,
    ): Promise<ReadonlyArray<BookingResourceSaved>> {
        return manager.query<Array<BookingResourceSaved>>(retire ? RETIRE_RESOURCE : DELETE_RESOURCE, [workspaceId, id])
    }
}
