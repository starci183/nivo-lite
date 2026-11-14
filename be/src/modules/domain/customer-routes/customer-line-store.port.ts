import type { EntityManager } from "typeorm"
import type { CustomerLineFile } from "./channel-delivery-store.port"
import type { DeliveryState } from "./delivery.policy"

/** Who a line is from: the person, or the shop (any agent, the engine's own line, a member's typed reply). */
export type CustomerLineDirection = "from_person" | "to_person"

/** One line of the conversation with a customer, as the store keeps it. */
export interface CustomerLine {
    /** The row id: the reference a module keeps when it needs one. */
    readonly id: string
    /** The insertion order (text of a bigint): the tie-break of the thread. */
    readonly seq: string
    /** The route it was said on. */
    readonly routeId: string
    /** The person, as their id was when it was said. */
    readonly contactId: string
    /** Who it is from. */
    readonly direction: CustomerLineDirection
    /** The once-key: the send key, or the source's own id of the message. */
    readonly key: string
    /** When it was said (ISO text): the order of the thread. */
    readonly saidAt: string
    /** The words (empty for a line of files only). */
    readonly text: string
    /** The files, by address. */
    readonly files: ReadonlyArray<CustomerLineFile>
    /** The order snapshot a sent line showed, or null. */
    readonly order: Readonly<Record<string, unknown>> | null
    /** The canonical event a heard line came in with, or null. */
    readonly eventId: string | null
    /** The agent that told a sent line, or null. */
    readonly agentId: string | null
    /** The member who typed a sent line, or null. */
    readonly memberId: string | null
    /** The run and step that told it, or null. */
    readonly runId: string | null
    readonly stepKey: string | null
    /** Where a sent line stands; null for a heard one. */
    readonly state: DeliveryState | null
    /** Why a sent line was refused, or what is known of an unknown outcome; null otherwise. */
    readonly reason: string | null
    /** The channel and the entrance. */
    readonly channel: string
    readonly accountId: string | null
    /** When the provider took a sent line (ISO text), or null. */
    readonly deliveredAt: string | null
}

/** What the engine writes for a line the person said. */
export interface HeardLineRow {
    readonly routeId: string
    readonly contactId: string
    readonly channel: string
    readonly accountId: string | null
    /** The source's own id of the message: the line is written once per route under it. */
    readonly key: string
    readonly text: string
    /** When it was said (already bounded by its receipt). */
    readonly saidAt: Date
    readonly files: ReadonlyArray<CustomerLineFile>
    readonly eventId: string | null
}

/** Where a page of a thread continues: strictly older than this line (said at, then insertion order). */
export interface LineCursor {
    readonly saidAt: Date
    readonly seq: string
}

/** A page of lines, newest first. */
export interface CustomerLineRows {
    readonly rows: ReadonlyArray<CustomerLine>
    /** Where the next (older) page starts, or null at the end. */
    readonly next: LineCursor | null
}

/** Which lines a window reads. */
export interface LineWindowAsk {
    /** The most rows. */
    readonly limit: number
    /** Older than this line, or null for the newest. */
    readonly before: LineCursor | null
    /** Said at or after this instant only, or null for every line. */
    readonly since: Date | null
    /** Sent lines in these states only (heard lines always pass), or null for every state. */
    readonly toldStates: ReadonlyArray<DeliveryState> | null
}

/** The lines of the conversations (public.customer_messages, both directions), each member scoped to the workspace it names. No raw SQL. */
export interface CustomerLineStore {
    /**
     * Writes a heard line once, in the caller's transaction: an insert-or-nothing on (workspace, route, key). Answers the row id and whether
     * this call wrote it (false: the same message was heard before, e.g. by the webhook and the poll).
     */
    insertHeard(manager: EntityManager, workspaceId: string, line: HeardLineRow): Promise<{ readonly id: string; readonly written: boolean }>
    /** The lines of the routes, newest first (said at, then insertion order). */
    windowOf(workspaceId: string, routeIds: ReadonlyArray<string>, ask: LineWindowAsk): Promise<CustomerLineRows>
    /** The lines of the contact ids (every route of theirs), newest first. */
    ofContacts(workspaceId: string, contactIds: ReadonlyArray<string>, ask: LineWindowAsk): Promise<CustomerLineRows>
    /** When the person last said something on the route, or null when never. */
    lastHeardAt(workspaceId: string, routeId: string): Promise<Date | null>
}

/** The injection token of the line store. */
export const CUSTOMER_LINE_STORE: unique symbol = Symbol("CUSTOMER_LINE_STORE")
