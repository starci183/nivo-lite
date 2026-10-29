import { Injectable } from "@nestjs/common"
import { In, IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    BookingResourceRecord,
    OptionalBookingResourceCapacity,
    BookingResourceStaffLink,
} from "./booking-resources-read.contracts"
import { BookingResourceEntity } from "./persistence/entities"

/** The most resources a workspace lists. */
const CATALOGUE_LIMIT = 200

@Injectable()
/** Resource reads for the capabilities that plan, show or name a resource. */
export class BookingResourcesReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The resources of a workspace in the owner's order, at most 200. */
    catalogue(workspaceId: string): Promise<ReadonlyArray<BookingResourceRecord>> {
        return this.entityManager.find(BookingResourceEntity, {
            where: { workspaceId },
            order: { sortOrder: "ASC", createdAt: "ASC" },
            take: CATALOGUE_LIMIT,
        })
    }

    /** The resources of a workspace that are linked to a staff member, at most 200. */
    staffLinked(workspaceId: string): Promise<ReadonlyArray<BookingResourceStaffLink>> {
        return this.entityManager.find(BookingResourceEntity, {
            select: { id: true, staffId: true },
            where: { workspaceId, staffId: Not(IsNull()) },
            take: CATALOGUE_LIMIT,
        })
    }

    /** The names of the given resources of a workspace, by id; a resource that is gone has no entry. */
    async namesOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> {
        const found =
            ids.length === 0
                ? []
                : await this.entityManager.find(BookingResourceEntity, {
                      select: { id: true, name: true },
                      where: { workspaceId, id: In([...ids]) },
                      take: ids.length,
                  })
        return new Map(found.map(({ id, name }) => [id, name]))
    }

    /** Locks a resource inside the caller's transaction and answers its capacity, or none when it is not in the workspace. */
    lockCapacity(manager: EntityManager, workspaceId: string, id: string): Promise<OptionalBookingResourceCapacity> {
        return manager.findOne(BookingResourceEntity, {
            select: { capacity: true },
            where: { id, workspaceId },
            lock: { mode: "pessimistic_write" },
        })
    }
}
