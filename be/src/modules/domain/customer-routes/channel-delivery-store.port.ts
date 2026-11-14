import type { DeliveryState } from "./delivery.policy"

/** One delivery row as the store keeps it. */
export interface StoredDelivery {
    /** The row id. */
    readonly id: string
    /** The insertion order of the ledger (text of a bigint): what a cursor is. */
    readonly seq: string
    /** The once-key of the send. */
    readonly sendKey: string
    /** The route the message went on. */
    readonly routeId: string
    /** The person it was told to. */
    readonly contactId: string
    /** The agent that told it, or null once that agent is gone. */
    readonly agentId: string | null
    /** The run that told it, or null. */
    readonly runId: string | null
    /** The step of the run, or null. */
    readonly stepKey: string | null
    /** The words told. */
    readonly text: string
    /** How many files went with it. */
    readonly attachmentCount: number
    /** The kinds of those files, in order. */
    readonly attachmentKinds: ReadonlyArray<string>
    /** Where the delivery stands. */
    readonly state: DeliveryState
    /** Why it was refused, or what is known of an unknown outcome; null otherwise. */
    readonly reason: string | null
    /** The id the provider gave the message, or null. */
    readonly providerMessageId: string | null
    /** The channel it went through. */
    readonly channel: string
    /** The connection, site or API key it went through, or null. */
    readonly accountId: string | null
    /** When the row was claimed (ISO text). */
    readonly createdAt: string
    /** When the provider took it (ISO text), or null. */
    readonly deliveredAt: string | null
}

/** What a claim writes: the send and the entrance, before the provider is asked. */
export interface DeliveryClaim {
    /** The once-key of the send, unique in the workspace. */
    readonly sendKey: string
    /** The route the message goes on. */
    readonly routeId: string
    /** The person it is told to (their current id). */
    readonly contactId: string
    /** The agent that tells it. */
    readonly agentId: string
    /** The run that tells it, or null for a send outside a run. */
    readonly runId: string | null
    /** The step of the run, or null. */
    readonly stepKey: string | null
    /** The words told. */
    readonly text: string
    /** How many files go with it. */
    readonly attachmentCount: number
    /** The kinds of those files, in order. */
    readonly attachmentKinds: ReadonlyArray<string>
    /** The channel it goes through. */
    readonly channel: string
    /** The connection, site or API key it goes through, or null. */
    readonly accountId: string | null
    /** The files that go with it, by address (absent: the sender gave none; the count above still says how many). */
    readonly files?: ReadonlyArray<CustomerLineFile> | undefined
    /** The order snapshot the customer is shown with it (the send's generic `LineOrder`), when there is one. */
    readonly order?: Readonly<Record<string, unknown>> | null | undefined
    /** The member of the shop who typed it (a reply from the workbench), else absent. */
    readonly memberId?: string | null | undefined
}

/** A file of a line: an address, never the bytes. */
export interface CustomerLineFile {
    /** Where the file is served from. */
    readonly url: string
    /** The name of the file, or empty. */
    readonly name: string
    /** The media type, or empty when the sender did not say. */
    readonly contentType: string
    /** The caption a sent picture carried, when it had one. */
    readonly caption?: string | undefined
}

/** What a settle writes. */
export interface DeliverySettle {
    /** The state the attempt ends at. */
    readonly state: "delivered" | "refused" | "unknown"
    /** The reason, or null. */
    readonly reason: string | null
    /** The provider's message id, or null. */
    readonly providerMessageId: string | null
    /** When the provider took it, for `delivered`. */
    readonly deliveredAt: Date | null
}

/** A stored delivery, or null when no row has the key. */
export type OptionalStoredDelivery = StoredDelivery | null

/** The cursor a page of deliveries starts after, or null for the first page. */
export type OptionalDeliveryCursor = string | null

/** A page of rows, newest first. */
export interface DeliveryRows {
    /** The rows. */
    readonly rows: ReadonlyArray<StoredDelivery>
    /** The cursor of the next page, or null at the end. */
    readonly next: string | null
}

/**
 * The delivery ledger: the `to_person` lines of public.customer_messages (what was said to the person), each member scoped to the
 * workspace it names. No raw SQL.
 */
export interface ChannelDeliveryStore {
    /** The row of a send key, or null. */
    byKey(workspaceId: string, sendKey: string): Promise<OptionalStoredDelivery>
    /** Writes the claimed row of a send key once: true when this call wrote it (an atomic insert-or-nothing on the unique key). */
    insertClaimed(workspaceId: string, claim: DeliveryClaim): Promise<boolean>
    /** Takes a REFUSED row back to claimed in one conditional statement: true when this call moved it. */
    reclaim(workspaceId: string, sendKey: string): Promise<boolean>
    /** Settles a row that is not delivered: true when a row moved (a delivered row never changes). */
    settle(workspaceId: string, sendKey: string, values: DeliverySettle): Promise<boolean>
    /** The rows of one route, newest first, at most `limit`, after the cursor. */
    ofRoute(workspaceId: string, routeId: string, limit: number, after: OptionalDeliveryCursor): Promise<DeliveryRows>
    /** The rows one step of one run claimed (every state), newest first, at most `limit`. */
    ofStep(workspaceId: string, runId: string, stepKey: string, limit: number): Promise<ReadonlyArray<StoredDelivery>>
    /** How many rows went out (state delivered) with the provider's take in `[from, to)`. */
    countDelivered(workspaceId: string, from: Date, to: Date): Promise<number>
    /** How many distinct routes have a delivered row taken in `[from, to)`. */
    countRoutesTold(workspaceId: string, from: Date, to: Date): Promise<number>
    /** The rows of the contact ids, newest first, at most `limit`, after the cursor. */
    ofContacts(workspaceId: string, contactIds: ReadonlyArray<string>, limit: number, after: OptionalDeliveryCursor): Promise<DeliveryRows>
}

/** The injection token of the delivery ledger store. */
export const CHANNEL_DELIVERY_STORE: unique symbol = Symbol("CHANNEL_DELIVERY_STORE")
