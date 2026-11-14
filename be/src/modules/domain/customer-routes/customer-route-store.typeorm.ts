import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CustomerRouteStore, HeldRoutesPage, NewCustomerRoute, RouteHold, StoredCustomerRoute } from "./customer-route-store.port"
import { ofLiveContact } from "./live-contact.policy"
import { CustomerRouteEntity } from "./persistence/entities"

const routeOf = (row: CustomerRouteEntity): StoredCustomerRoute => ({
    id: row.id,
    contactId: row.contactId,
    channel: row.channel,
    accountId: row.accountId,
    createdAt: row.createdAt.toISOString(),
})

const isIdRow = (value: unknown): value is { readonly id: string } =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/** The hold a row keeps, or null when nobody holds the route. */
const holdOfRow = (row: CustomerRouteEntity): RouteHold | null =>
    row.heldByMemberId === null || row.heldAt === null ? null : { memberId: row.heldByMemberId, at: row.heldAt.toISOString() }

@Injectable()
/** The routes on public.customer_routes, on the primary connection; every write is one statement. No raw SQL. */
export class TypeormCustomerRouteStore implements CustomerRouteStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * Every read starts here: the routes of the workspace whose contact is not deleted (soft delete, R31: the rows stay, reads skip them);
     * on the caller's transaction when it hands one.
     */
    private live(workspaceId: string, manager: EntityManager = this.entityManager): SelectQueryBuilder<CustomerRouteEntity> {
        return ofLiveContact(manager.createQueryBuilder(CustomerRouteEntity, "route"), "route").where(
            "route.workspaceId = :workspaceId",
            { workspaceId },
        )
    }

    /** One route by id, or null (a route of a deleted contact is none). */
    async byId(workspaceId: string, routeId: string): Promise<StoredCustomerRoute | null> {
        const row = await this.live(workspaceId).andWhere("route.id = :routeId", { routeId }).getOne()
        return row === null ? null : routeOf(row)
    }

    /** The oldest route of one entrance held by any of the contact ids, or null (a deleted contact's routes are left out). */
    async ofEntrance(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        channel: string,
        accountId: string | null,
    ): Promise<StoredCustomerRoute | null> {
        if (contactIds.length === 0) return null
        const query = this.live(workspaceId)
            .andWhere("route.contactId IN (:...contactIds)", { contactIds: [...contactIds] })
            .andWhere("route.channel = :channel", { channel })
        const row = await (accountId === null
            ? query.andWhere("route.accountId IS NULL")
            : query.andWhere("route.accountId = :accountId", { accountId })
        )
            .orderBy("route.createdAt", "ASC")
            .addOrderBy("route.id", "ASC")
            .getOne()
        return row === null ? null : routeOf(row)
    }

    /** The routes of the contact ids, oldest first, at most `limit` (a deleted contact's routes are left out). */
    async ofContacts(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<StoredCustomerRoute>> {
        if (contactIds.length === 0) return []
        const rows = await this.live(workspaceId)
            .andWhere("route.contactId IN (:...contactIds)", { contactIds: [...contactIds] })
            .orderBy("route.createdAt", "ASC")
            .addOrderBy("route.id", "ASC")
            .limit(limit)
            .getMany()
        return rows.map((row) => routeOf(row))
    }

    /** The hold of a live route, or null (nobody holds it, or no live route has the id); read on the caller's transaction when it hands one. */
    async holdOf(workspaceId: string, routeId: string, manager?: EntityManager): Promise<RouteHold | null> {
        const row = await this.live(workspaceId, manager).andWhere("route.id = :routeId", { routeId }).getOne()
        return row === null ? null : holdOfRow(row)
    }

    /** The live routes of the workspace a member holds: one page, the latest hold first, and the count of all of them. */
    async held(workspaceId: string, limit: number): Promise<HeldRoutesPage> {
        const [rows, count] = await this.live(workspaceId)
            .andWhere("route.heldByMemberId IS NOT NULL")
            .orderBy("route.heldAt", "DESC")
            .addOrderBy("route.id", "ASC")
            .take(limit)
            .getManyAndCount()
        const routes = rows.flatMap((row) => {
            const hold = holdOfRow(row)
            return hold === null ? [] : [{ routeId: row.id, ...hold }]
        })
        return { count, routes }
    }

    /**
     * Sets the hold of a live route: the route is read live first (a deleted contact's route takes no hold), then ONE update writes the
     * member and the database's now; a route the same member already holds keeps its first stamp. False when no live route has the id.
     */
    async hold(workspaceId: string, routeId: string, memberId: string): Promise<boolean> {
        const row = await this.live(workspaceId).andWhere("route.id = :routeId", { routeId }).getOne()
        if (row === null) return false
        await this.entityManager
            .createQueryBuilder(CustomerRouteEntity, "route")
            .update()
            .set({ heldByMemberId: memberId, heldAt: () => "now()" })
            .where("workspace_id = :workspaceId AND id = :routeId", { workspaceId, routeId })
            .andWhere("held_by_member_id IS DISTINCT FROM :memberId", { memberId })
            .execute()
        return true
    }

    /**
     * Clears the hold of a route and answers the hold it cleared, or null when nobody held it; on the caller's transaction when it hands
     * one. The hold is READ first, then ONE update clears the hold of that member: an update that finds the route released or taken by
     * another member meanwhile clears nothing and answers null. (A `RETURNING` of the cleared columns answers the row AFTER the update,
     * its nulls: it can never say who held the route.)
     */
    async release(workspaceId: string, routeId: string, manager: EntityManager = this.entityManager): Promise<RouteHold | null> {
        const row = await manager
            .createQueryBuilder(CustomerRouteEntity, "route")
            .where("route.workspaceId = :workspaceId AND route.id = :routeId", { workspaceId, routeId })
            .andWhere("route.heldByMemberId IS NOT NULL")
            .getOne()
        const held = row === null ? null : holdOfRow(row)
        if (held === null) return null
        const result = await manager
            .createQueryBuilder(CustomerRouteEntity, "route")
            .update()
            .set({ heldByMemberId: null, heldAt: null })
            .where("workspace_id = :workspaceId AND id = :routeId", { workspaceId, routeId })
            .andWhere("held_by_member_id = :memberId", { memberId: held.memberId })
            .execute()
        return (result.affected ?? 0) > 0 ? held : null
    }

    /** Writes the route once: the id of the row this call wrote, or null when the unique key or the id was taken first. */
    async insert(workspaceId: string, route: NewCustomerRoute): Promise<string | null> {
        const result = await this.entityManager
            .createQueryBuilder(CustomerRouteEntity, "route")
            .insert()
            .values({
                workspaceId,
                ...(route.id === undefined ? {} : { id: route.id }),
                contactId: route.contactId,
                channel: route.channel,
                accountId: route.accountId,
            })
            .orIgnore()
            .returning(["id"])
            .execute()
        // Postgres answers the inserted rows: none when another try wrote the key (or the id) first.
        const returned: unknown = result.raw
        if (!Array.isArray(returned)) return null
        const [first]: ReadonlyArray<unknown> = returned
        return isIdRow(first) ? first.id : null
    }
}
