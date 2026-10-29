import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingExceptionCreateParams, BookingExceptionSaved } from "./booking-exceptions.contracts"
import { BookingExceptionEntity } from "./persistence/entities"

@Injectable()
/** Owns booking calendar exceptions after the coordinator proves workspace and resource ownership. */
export class BookingExceptionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Creates a validated exception in the coordinator's resource-ownership transaction. */
    async create(
        params: BookingExceptionCreateParams,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingExceptionSaved>> {
        const saved = await manager.save(
            BookingExceptionEntity,
            manager.create(BookingExceptionEntity, {
                workspaceId: params.workspaceId,
                resourceId: params.resourceId,
                onDate: params.date,
                closed: params.closed,
                startTime: params.start,
                endTime: params.end,
                note: params.note,
            }),
        )
        return [{ id: saved.id }]
    }

    /** Removes an exception only from the selected workspace and returns its identity. */
    async remove(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingExceptionSaved>> {
        const removed = await manager.delete(BookingExceptionEntity, { workspaceId, id })
        return (removed.affected ?? 0) > 0 ? [{ id }] : []
    }
}
