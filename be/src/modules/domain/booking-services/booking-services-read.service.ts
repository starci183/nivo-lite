import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingServiceRecord, BookingServiceTiming } from "./booking-services-read.contracts"
import { BookingServiceEntity } from "./persistence/entities"

/** The most services a workspace lists. */
const CATALOGUE_LIMIT = 200

@Injectable()
/** Service catalogue reads for the capabilities that book, show or name a service. */
export class BookingServicesReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The services of a workspace in the owner's order, at most 200. */
    catalogue(workspaceId: string): Promise<ReadonlyArray<BookingServiceRecord>> {
        return this.entityManager.find(BookingServiceEntity, {
            where: { workspaceId },
            order: { sortOrder: "ASC", createdAt: "ASC" },
            take: CATALOGUE_LIMIT,
        })
    }

    /** The current names of the given services of a workspace, by id; a service that is gone has no entry. */
    async namesOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> {
        if (ids.length === 0) return new Map()
        const rows = await this.entityManager.find(BookingServiceEntity, {
            select: { id: true, name: true },
            where: { workspaceId, id: In([...ids]) },
            take: ids.length,
        })
        return new Map(rows.map((row) => [row.id, row.name]))
    }

    /** How long a service holds a resource, or none when the service is gone. */
    timingOf(workspaceId: string, id: string): Promise<BookingServiceTiming | null> {
        return this.entityManager.findOne(BookingServiceEntity, {
            select: { durationMin: true, bufferMin: true },
            where: { workspaceId, id },
        })
    }
}
