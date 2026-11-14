import { Inject, Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import {
    CUSTOMER_ROUTE_STORE,
    type CustomerRouteStore,
    type HeldRoutesPage,
    type OptionalRouteHold,
    type StoredCustomerRoute,
} from "./customer-route-store.port"
import { CustomerRoutesError, CustomerRoutesErrorCode } from "./errors/customer-routes.error"

/** The most routes one list of a contact holds. */
export const ROUTES_PAGE_MAX = 100

/** A route, or null when none matched. */
export type OptionalCustomerRoute = CustomerRoute | null

/** One entrance: the channel and the account (connection, website site or API key) it goes through, null when it has none. */
export interface RouteEntrance {
    /** The channel. */
    readonly channel: string
    /** The connection, site or API key; null when the entrance has none. */
    readonly accountId: string | null
}

/** One route, with its contact as it stands now (a merged contact answers its survivor). */
export interface CustomerRoute extends RouteEntrance {
    /** The route id: what every engine `conversation_id` column holds. */
    readonly id: string
    /** The person the route reaches now. */
    readonly contactId: string
    /** When it was born (ISO text). */
    readonly createdAt: string
}

/** What `ensure` is asked. */
export interface EnsureRoute extends RouteEntrance {
    /** The person (an id merged into another is followed to its survivor). */
    readonly contactId: string
    /**
     * The id of an existing conversation to give the route when it is born (the route of an existing conversation IS its id, so holds
     * and stops keyed by it keep working). Ignored when the route already exists: the route keeps the id it has.
     */
    readonly adoptId?: string | undefined
}

/** What `ensure` answers: the route id, and whether this call made the route. */
export interface EnsuredRoute {
    /** The route id. */
    readonly routeId: string
    /** True when this call wrote the route; false when it already stood or another try wrote it first. */
    readonly created: boolean
}

/** What taking a route's thread over did: `held` (the member holds it now), `not_found` (no live route by that id). */
export type RouteHoldOutcome = "held" | "not_found"

const routeBody = (route: StoredCustomerRoute, contactId: string): CustomerRoute => ({
    id: route.id,
    contactId,
    channel: route.channel,
    accountId: route.accountId,
    createdAt: route.createdAt,
})

@Injectable()
/**
 * The routes of the customers: the opaque id the engine keeps per (workspace, contact, entrance), and the way back from the id to the
 * person and the entrance. A merge of two contacts is followed at read time through the contacts' one redirect: an entrance is found
 * under any id merged into the person, and a route answers its contact's survivor. The routes of a deleted contact stay in the table and every read here leaves them out
 * (soft delete, owner ruling R31). Nothing here knows a conversation of any plugin.
 */
export class CustomerRoutesService {
    constructor(
        @Inject(CUSTOMER_ROUTE_STORE) private readonly store: CustomerRouteStore,
        private readonly contacts: ContactsService,
    ) {}

    /**
     * The route of a person on an entrance, written once: idempotent, and a race of two tries leaves one row (the insert is an
     * insert-or-nothing on the unique key, the loser reads the winner). Refuses an unknown person, a DELETED person (soft delete, R31: the
     * same human writing again is a new contact with its own route), and an `adoptId` that already names another route.
     */
    async ensure(workspaceId: string, request: EnsureRoute): Promise<EnsuredRoute> {
        const current = await this.contacts.activeId(workspaceId, request.contactId)
        if (current === null) throw new CustomerRoutesError({ code: CustomerRoutesErrorCode.ContactUnknown })
        const aliases = await this.contacts.aliasesOf(workspaceId, current)
        const standing = await this.store.ofEntrance(workspaceId, aliases, request.channel, request.accountId)
        if (standing !== null) return { routeId: standing.id, created: false }
        const written = await this.store.insert(workspaceId, {
            id: request.adoptId,
            contactId: current,
            channel: request.channel,
            accountId: request.accountId,
        })
        if (written !== null) return { routeId: written, created: true }
        const winner = await this.store.ofEntrance(workspaceId, aliases, request.channel, request.accountId)
        if (winner === null) throw new CustomerRoutesError({ code: CustomerRoutesErrorCode.IdTaken })
        return { routeId: winner.id, created: false }
    }

    /** The route of a person on an entrance when it exists; nothing is written. */
    async find(workspaceId: string, contactId: string, entrance: RouteEntrance): Promise<OptionalCustomerRoute> {
        const current = await this.contacts.activeId(workspaceId, contactId)
        if (current === null) return null
        const aliases = await this.contacts.aliasesOf(workspaceId, current)
        const route = await this.store.ofEntrance(workspaceId, aliases, entrance.channel, entrance.accountId)
        return route === null ? null : routeBody(route, current)
    }

    /** The person (as they stand now) and the entrance a route id stands for; null for an id the workspace does not hold and for the route of a deleted person. */
    async get(workspaceId: string, routeId: string): Promise<OptionalCustomerRoute> {
        const route = await this.store.byId(workspaceId, routeId)
        if (route === null) return null
        const current = await this.contacts.current(workspaceId, route.contactId)
        return routeBody(route, current ?? route.contactId)
    }

    /**
     * THE STAFF HOLD (coordinator ruling R43): a member of the shop takes the thread of a route over. While it is held the customer-send
     * door refuses every AI send to the route (`route_held`); a member's typed reply goes; a parked wait still takes the person's lines.
     * Generic: it names a route and a member, nothing of any chat. `not_found` for a route the workspace does not hold live.
     */
    async hold(workspaceId: string, routeId: string, memberId: string): Promise<RouteHoldOutcome> {
        return (await this.store.hold(workspaceId, routeId, memberId)) ? "held" : "not_found"
    }

    /**
     * Ends the staff hold of a route ("hand back to the agent"): the hold it ended, or null when nobody held it; in the caller's
     * transaction when it hands one (the hand-back clears the hold, ends the take-over and delivers its resume event in one).
     */
    async release(workspaceId: string, routeId: string, manager?: EntityManager): Promise<OptionalRouteHold> {
        return manager === undefined ? this.store.release(workspaceId, routeId) : this.store.release(workspaceId, routeId, manager)
    }

    /**
     * Who holds a route now, or null when the agents speak on it (or the workspace holds no live route by that id); read in the caller's
     * transaction when it hands one.
     */
    async holdOf(workspaceId: string, routeId: string, manager?: EntityManager): Promise<OptionalRouteHold> {
        return manager === undefined ? this.store.holdOf(workspaceId, routeId) : this.store.holdOf(workspaceId, routeId, manager)
    }

    /**
     * The routes a member of the shop holds now in the workspace (ruling R45: the inbox's "held by a person" filter and count): the latest
     * hold first, at most `limit` (never over `ROUTES_PAGE_MAX`), with how many are held in all.
     */
    async held(workspaceId: string, limit: number = ROUTES_PAGE_MAX): Promise<HeldRoutesPage> {
        return this.store.held(workspaceId, Math.max(1, Math.min(limit, ROUTES_PAGE_MAX)))
    }

    /** The routes of a person (under every id merged into them), oldest first, at most `limit` (never over `ROUTES_PAGE_MAX`). */
    async listByContact(
        workspaceId: string,
        contactId: string,
        limit: number = ROUTES_PAGE_MAX,
    ): Promise<ReadonlyArray<CustomerRoute>> {
        const current = await this.contacts.activeId(workspaceId, contactId)
        if (current === null) return []
        const aliases = await this.contacts.aliasesOf(workspaceId, current)
        const routes = await this.store.ofContacts(workspaceId, aliases, Math.max(1, Math.min(limit, ROUTES_PAGE_MAX)))
        return routes.map((route) => routeBody(route, current))
    }
}
