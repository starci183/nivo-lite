import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingWaitRecord } from "./booking-waitlist-read.contracts"
import { BookingWaitlistEntity } from "./persistence/entities"

/** The most waiting customers one read answers. */
const OPEN_LIMIT = 100

@Injectable()
/** Waitlist reads for the capabilities that show the waiting line. */
export class BookingWaitlistReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The customers still waiting or notified, newest first, at most 100. */
    open(workspaceId: string): Promise<ReadonlyArray<BookingWaitRecord>> {
        return this.entityManager.find(BookingWaitlistEntity, {
            where: { workspaceId, status: In(["waiting", "notified"]) },
            order: { createdAt: "DESC", id: "ASC" },
            take: OPEN_LIMIT,
        })
    }
}
