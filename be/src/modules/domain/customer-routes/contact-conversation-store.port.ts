import type { CustomerLineRows, LineCursor } from "./customer-line-store.port"
import type { HeldRoute } from "./customer-route-store.port"

/** What happened on one route lately: when the last line was said and which agent spoke last. */
export interface RouteActivity {
    /** The route. */
    readonly routeId: string
    /** When the newest line of the route was said (ISO text), in either direction. */
    readonly lastLineAt: string
    /** The agent that told the newest line an agent told on the route, or null when no agent has spoken on it. */
    readonly lastAgentId: string | null
}

/** Which lines of a person a page reads. */
export interface ContactLinesAsk {
    /** One route of the person, or null for every route (merged by time). */
    readonly routeId: string | null
    /** Older than this line, or null for the newest. */
    readonly before: LineCursor | null
    /** The most lines. */
    readonly limit: number
}

/**
 * The reads the contacts page makes over the engine's routes and lines, scoped to a workspace and to live contacts and live entrances
 * (soft delete: R31 a deleted contact, R36 a removed connection). No raw SQL.
 */
export interface ContactConversationStore {
    /** The activity of each route that has lines (a route with none is absent); the routes are bounded by the caller. */
    activityOf(workspaceId: string, routeIds: ReadonlyArray<string>): Promise<ReadonlyArray<RouteActivity>>
    /** The holds among these live routes: the routes a member of the shop holds now. */
    holdsOf(workspaceId: string, routeIds: ReadonlyArray<string>): Promise<ReadonlyArray<HeldRoute>>
    /** The lines of the contact ids (every route of theirs, or one), newest first, merged by time. */
    linesOf(workspaceId: string, contactIds: ReadonlyArray<string>, ask: ContactLinesAsk): Promise<CustomerLineRows>
}

/** The injection token of the contact conversation store. */
export const CONTACT_CONVERSATION_STORE: unique symbol = Symbol("CONTACT_CONVERSATION_STORE")
