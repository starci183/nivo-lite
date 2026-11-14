import type { EntityManager } from "typeorm"

/** One route as the store keeps it. */
export interface StoredCustomerRoute {
    /** The route id: what every engine `conversation_id` column holds. */
    readonly id: string
    /** The person the route reaches, as written. */
    readonly contactId: string
    /** The channel. */
    readonly channel: string
    /** The connection, site or API key of the entrance, or null. */
    readonly accountId: string | null
    /** When it was born (ISO text). */
    readonly createdAt: string
}

/** What a new route is written with. */
export interface NewCustomerRoute {
    /** The id to give it (an existing conversation's id); absent, the database makes one. */
    readonly id?: string | undefined
    /** The person. */
    readonly contactId: string
    /** The channel. */
    readonly channel: string
    /** The entrance's account, or null. */
    readonly accountId: string | null
}

/** A stored route, or null when none matched. */
export type OptionalStoredCustomerRoute = StoredCustomerRoute | null

/** The connection account of a route's entrance, or null for an entrance that names none. */
export type OptionalRouteAccount = string | null

/** The id of a route this call wrote, or null when the key was taken first. */
export type OptionalRouteId = string | null

/** A member of the shop holding a route (the staff hold, ruling R43). */
export interface RouteHold {
    /** The member who took the thread over. */
    readonly memberId: string
    /** When, ISO text. */
    readonly at: string
}

/** A held route: its id and its hold. */
export interface HeldRoute extends RouteHold {
    /** The route. */
    readonly routeId: string
}

/** One page of the held routes of a workspace and how many are held in all. */
export interface HeldRoutesPage {
    /** How many live routes of the workspace a member holds now. */
    readonly count: number
    /** The held routes, the latest hold first, at most the page asked. */
    readonly routes: ReadonlyArray<HeldRoute>
}

/** A route's hold, or null when nobody holds it (or no live route has the id). */
export type OptionalRouteHold = RouteHold | null

/** The routes of the workspaces (public.customer_routes), each member scoped to the workspace it names. No raw SQL. */
export interface CustomerRouteStore {
    /** One route by id, or null. */
    byId(workspaceId: string, routeId: string): Promise<OptionalStoredCustomerRoute>
    /** The oldest route of one entrance held by any of the contact ids, or null. */
    ofEntrance(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        channel: string,
        accountId: OptionalRouteAccount,
    ): Promise<OptionalStoredCustomerRoute>
    /** The routes of the contact ids, oldest first, at most `limit`. */
    ofContacts(workspaceId: string, contactIds: ReadonlyArray<string>, limit: number): Promise<ReadonlyArray<StoredCustomerRoute>>
    /**
     * Writes a route once under its unique key (an atomic insert-or-nothing): the id of the row this call wrote, or null when the key
     * (or the id asked for) was taken first, which the caller then reads.
     */
    insert(workspaceId: string, route: NewCustomerRoute): Promise<OptionalRouteId>
    /**
     * The hold of a live route, or null when nobody holds it or the workspace has no live route by that id; read on the caller's
     * transaction when it hands one (a delivery in the same transaction as a hand-back sees the hold cleared).
     */
    holdOf(workspaceId: string, routeId: string, manager?: EntityManager): Promise<OptionalRouteHold>
    /**
     * Sets the hold of a live route to the member, stamped now by the database, in one statement; a route the same member already
     * holds keeps its first stamp. False when the workspace has no live route by that id.
     */
    hold(workspaceId: string, routeId: string, memberId: string): Promise<boolean>
    /** The live routes of the workspace a member holds, the latest hold first, at most `limit`, with how many are held in all. */
    held(workspaceId: string, limit: number): Promise<HeldRoutesPage>
    /** Clears the hold of a route: the hold it cleared, or null when nobody held it; on the caller's transaction when it hands one. */
    release(workspaceId: string, routeId: string, manager?: EntityManager): Promise<OptionalRouteHold>
}

/** The injection token of the customer route store. */
export const CUSTOMER_ROUTE_STORE: unique symbol = Symbol("CUSTOMER_ROUTE_STORE")
