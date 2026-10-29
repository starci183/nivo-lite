import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { StaffDirectoryService } from "@modules/domain/staff"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingResourceSaved, BookingResourceWrite } from "./booking-resources.contracts"
import { BookingResourceEntity } from "./persistence/entities"

/** The ids a statement with `returning id` hands back. */
const savedOf = (raw: unknown): Array<BookingResourceSaved> =>
    Array.isArray(raw) ? (raw as Array<BookingResourceSaved>).slice(0, 1).map((row) => ({ id: row.id })) : []

@Injectable()
/** Owns resource persistence; callers authorize setup writes and supply their atomic calendar transaction. */
export class BookingResourcesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly staff: StaffDirectoryService,
    ) {}

    /** Saves one resource inside the setup transaction after any staff link has been proven. */
    async save(
        params: BookingResourceWrite,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingResourceSaved>> {
        const values = {
            name: params.name,
            kind: params.kind,
            capacity: params.capacity,
            active: params.active,
            staffId: params.staffId,
        }
        if (params.id === null) {
            const created = await manager
                .createQueryBuilder(BookingResourceEntity, "br")
                .insert()
                .values({ workspaceId: params.workspaceId, ...values })
                .returning("id")
                .execute()
            return savedOf(created.raw)
        }
        const changed = await manager
            .createQueryBuilder(BookingResourceEntity, "br")
            .update()
            .set(values)
            .where({ workspaceId: params.workspaceId, id: params.id })
            .returning("id")
            .execute()
        return savedOf(changed.raw)
    }

    /** Holds the owned resource until its setup transaction finishes. */
    async lock(workspaceId: string, id: string, manager: EntityManager): Promise<ReadonlyArray<BookingResourceSaved>> {
        const held = await manager.findOne(BookingResourceEntity, {
            select: { id: true },
            where: { workspaceId, id },
            lock: { mode: "pessimistic_write" },
        })
        return held === null ? [] : [{ id: held.id }]
    }

    /** Proves a staff link within the same workspace as the resource. */
    async lockStaff(workspaceId: string, id: string): Promise<ReadonlyArray<BookingResourceSaved>> {
        const [found] = await this.staff.namesOf(workspaceId, [id])
        return found === undefined ? [] : [{ id: found.id }]
    }

    /** Reports whether booking or waitlist history still references the resource. */
    async used(workspaceId: string, id: string, manager: EntityManager): Promise<boolean> {
        const referenced = await manager
            .createQueryBuilder(BookingResourceEntity, "o")
            .select("o.id", "id")
            .where("o.workspaceId = :workspaceId AND o.id = :id", { workspaceId, id })
            .andWhere(
                "(EXISTS (SELECT 1 FROM public.bookings b WHERE b.workspace_id = :workspaceId AND b.resource_id = :id) OR EXISTS (SELECT 1 FROM public.booking_waitlist w WHERE w.workspace_id = :workspaceId AND w.resource_id = :id))",
            )
            .getRawOne<{ id: string }>()
        return referenced !== undefined
    }

    /** Deletes an unused locked resource, or retires it when its history must remain. */
    async remove(
        workspaceId: string,
        id: string,
        retire: boolean,
        manager: EntityManager,
    ): Promise<ReadonlyArray<BookingResourceSaved>> {
        const where = { workspaceId, id }
        const changed = retire
            ? await manager
                  .createQueryBuilder(BookingResourceEntity, "br")
                  .update()
                  .set({ active: false })
                  .where(where)
                  .returning("id")
                  .execute()
            : await manager
                  .createQueryBuilder(BookingResourceEntity, "br")
                  .delete()
                  .where(where)
                  .returning("id")
                  .execute()
        return savedOf(changed.raw)
    }
}
