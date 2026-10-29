import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingServiceSaved, BookingServiceWrite } from "./booking-services.contracts"
import { BookingServiceEntity } from "./persistence/entities"

/** True when a returned row carries a text id. */
const hasId = (row: unknown): row is BookingServiceSaved =>
    typeof row === "object" && row !== null && "id" in row && typeof row.id === "string"

/** The ids a statement with `returning id` hands back. */
const savedOf = (raw: unknown): Array<BookingServiceSaved> =>
    Array.isArray(raw) ? raw.filter(hasId).slice(0, 1).map((row) => ({ id: row.id })) : []

@Injectable()
/** Owns service catalogue persistence; the caller proves its membership and validates the supplied fields. */
export class BookingServicesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Creates or updates one workspace-owned service, optionally joining the caller's transaction. */
    async save(
        params: BookingServiceWrite,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingServiceSaved>> {
        const values = {
            name: params.name,
            description: params.description,
            durationMin: params.durationMin,
            bufferMin: params.bufferMin,
            priceVnd: params.priceVnd === null ? null : String(params.priceVnd),
            resourceKind: params.resourceKind,
            followupDays: params.followupDays,
            active: params.active,
        }
        if (params.id === null) {
            const created = await manager
                .createQueryBuilder(BookingServiceEntity, "bs")
                .insert()
                .values({ workspaceId: params.workspaceId, ...values })
                .returning("id")
                .execute()
            return savedOf(created.raw)
        }
        const changed = await manager
            .createQueryBuilder(BookingServiceEntity, "bs")
            .update()
            .set(values)
            .where({ workspaceId: params.workspaceId, id: params.id })
            .returning("id")
            .execute()
        return savedOf(changed.raw)
    }

    /** Holds the owned service until the removal transaction finishes. */
    async lock(workspaceId: string, id: string, manager: EntityManager): Promise<ReadonlyArray<BookingServiceSaved>> {
        const held = await manager.findOne(BookingServiceEntity, {
            select: { id: true },
            where: { workspaceId, id },
            lock: { mode: "pessimistic_write" },
        })
        return held === null ? [] : [{ id: held.id }]
    }

    /** Reports whether bookings or waitlist entries still reference the service. */
    async used(workspaceId: string, id: string, manager: EntityManager): Promise<boolean> {
        const referenced = await manager
            .createQueryBuilder(BookingServiceEntity, "o")
            .select("o.id", "id")
            .where("o.workspaceId = :workspaceId AND o.id = :id", { workspaceId, id })
            .andWhere(
                "(EXISTS (SELECT 1 FROM public.bookings b WHERE b.workspace_id = :workspaceId AND b.service_id = :id) OR EXISTS (SELECT 1 FROM public.booking_waitlist w WHERE w.workspace_id = :workspaceId AND w.service_id = :id))",
            )
            .getRawOne<{ id: string }>()
        return referenced !== undefined
    }

    /** Removes an unused locked service, or retires it when its history must remain. */
    async remove(
        workspaceId: string,
        id: string,
        retire: boolean,
        manager: EntityManager,
    ): Promise<ReadonlyArray<BookingServiceSaved>> {
        const where = { workspaceId, id }
        const changed = retire
            ? await manager
                  .createQueryBuilder(BookingServiceEntity, "bs")
                  .update()
                  .set({ active: false })
                  .where(where)
                  .returning("id")
                  .execute()
            : await manager
                  .createQueryBuilder(BookingServiceEntity, "bs")
                  .delete()
                  .where(where)
                  .returning("id")
                  .execute()
        return savedOf(changed.raw)
    }
}
