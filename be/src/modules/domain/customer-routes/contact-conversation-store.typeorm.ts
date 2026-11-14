import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContactConversationStore, ContactLinesAsk, RouteActivity } from "./contact-conversation-store.port"
import type { CustomerLineRows } from "./customer-line-store.port"
import { pageOfLines } from "./customer-line-store.typeorm"
import type { HeldRoute } from "./customer-route-store.port"
import { ofLiveContact } from "./live-contact.policy"
import { CustomerMessageEntity, CustomerRouteEntity } from "./persistence/entities"

const isActivityRow = (value: unknown): value is { readonly routeId: string; readonly lastAt: Date | string } =>
    typeof value === "object" && value !== null && "routeId" in value && typeof value.routeId === "string" && "lastAt" in value

@Injectable()
/**
 * The contacts page's reads of the routes and lines on public.customer_routes and public.customer_messages, on the primary connection.
 * Every read joins the live contact and the live entrance (`ofLiveContact`), so the rows of a deleted contact and of a removed
 * connection stay in the tables and never come out. The merged thread is ONE keyset page over (said at, insertion order), served by the
 * index `customer_messages_contact_window` (workspace, contact, said at desc, seq desc); a route filter narrows it by `route_id`.
 */
export class TypeormContactConversationStore implements ContactConversationStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** When each route was last spoken on and which agent spoke last: two reads, bounded by the routes asked. */
    async activityOf(workspaceId: string, routeIds: ReadonlyArray<string>): Promise<ReadonlyArray<RouteActivity>> {
        if (routeIds.length === 0) return []
        const lasts: ReadonlyArray<unknown> = await ofLiveContact(
            this.entityManager.createQueryBuilder(CustomerMessageEntity, "line"),
            "line",
        )
            .select("line.routeId", "routeId")
            .addSelect("MAX(line.saidAt)", "lastAt")
            .where("line.workspaceId = :workspaceId", { workspaceId })
            .andWhere("line.routeId IN (:...routeIds)", { routeIds: [...routeIds] })
            .groupBy("line.routeId")
            .getRawMany()
        const spoke = await ofLiveContact(this.entityManager.createQueryBuilder(CustomerMessageEntity, "line"), "line")
            .distinctOn(["line.routeId"])
            .where("line.workspaceId = :workspaceId", { workspaceId })
            .andWhere("line.routeId IN (:...routeIds)", { routeIds: [...routeIds] })
            .andWhere("line.direction = 'to_person' AND line.agentId IS NOT NULL")
            .orderBy("line.routeId")
            .addOrderBy("line.saidAt", "DESC")
            .addOrderBy("line.seq", "DESC")
            .getMany()
        const agentOf = new Map(spoke.map((row) => [row.routeId, row.agentId]))
        return lasts.filter(isActivityRow).map((row) => ({
            routeId: row.routeId,
            lastLineAt: new Date(row.lastAt).toISOString(),
            lastAgentId: agentOf.get(row.routeId) ?? null,
        }))
    }

    /** The routes among these that a member holds now. */
    async holdsOf(workspaceId: string, routeIds: ReadonlyArray<string>): Promise<ReadonlyArray<HeldRoute>> {
        if (routeIds.length === 0) return []
        const rows = await ofLiveContact(this.entityManager.createQueryBuilder(CustomerRouteEntity, "route"), "route")
            .where("route.workspaceId = :workspaceId", { workspaceId })
            .andWhere("route.id IN (:...routeIds)", { routeIds: [...routeIds] })
            .andWhere("route.heldByMemberId IS NOT NULL AND route.heldAt IS NOT NULL")
            .getMany()
        return rows.flatMap((row) =>
            row.heldByMemberId === null || row.heldAt === null
                ? []
                : [{ routeId: row.id, memberId: row.heldByMemberId, at: row.heldAt.toISOString() }],
        )
    }

    /** One page of the lines of the contact ids, newest first: every route, or the one asked. */
    linesOf(workspaceId: string, contactIds: ReadonlyArray<string>, ask: ContactLinesAsk): Promise<CustomerLineRows> {
        if (contactIds.length === 0) return Promise.resolve({ rows: [], next: null })
        const query = ofLiveContact(this.entityManager.createQueryBuilder(CustomerMessageEntity, "line"), "line")
            .where("line.workspaceId = :workspaceId", { workspaceId })
            .andWhere("line.contactId IN (:...contactIds)", { contactIds: [...contactIds] })
        if (ask.routeId !== null) query.andWhere("line.routeId = :routeId", { routeId: ask.routeId })
        return pageOfLines(query, { limit: ask.limit, before: ask.before, since: null, toldStates: null })
    }
}
