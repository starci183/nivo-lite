import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, namesById } from "@modules/platform/database"
import type { BookingServiceRecord, OptionalBookingServiceTiming } from "./booking-services-read.contracts"
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
    namesOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> {
        return namesById(this.entityManager, BookingServiceEntity, { workspaceId, id: In([...ids]) }, ids)
    }

    /** How long a service holds a resource, or none when the service is gone. */
    timingOf(workspaceId: string, id: string): Promise<OptionalBookingServiceTiming> {
        return this.entityManager.findOne(BookingServiceEntity, {
            select: { durationMin: true, bufferMin: true },
            where: { workspaceId, id },
        })
    }
}
