import type { CustomerLineFile, DeliveryState } from "@modules/domain/customer-routes"

/** The agent whose workbench holds a route's conversation now: its installation names where the workbench lives. */
export interface WorkbenchTargetView {
    /** The agent that spoke last on the route. */
    readonly agentId: string
    /** The agent's display name. */
    readonly agentName: string
    /** The key of the agent's module. */
    readonly moduleKey: string
    /** The installation the agent runs as. */
    readonly installationId: string
}

/** The member of the shop who holds a route (the staff hold, R43). */
export interface RouteHolderView {
    /** The membership id (the seat of the person in the workspace). */
    readonly memberId: string
    /** The member's display name, or null when the seat is gone. */
    readonly name: string | null
    /** When the member took the thread over (ISO text). */
    readonly at: string
}

/** One route of a person on the contacts page. */
export interface ContactRouteView {
    /** The route id. */
    readonly routeId: string
    /** The channel of the route (`zalo`, `telegram`, `website`, ...). */
    readonly channel: string
    /** The connection, site or API key of the entrance, or null. */
    readonly accountId: string | null
    /** The connection's name, or null when the entrance is no connection (a site, a key) or it has none. */
    readonly accountName: string | null
    /** The provider of the connection, or null when the entrance is no connection. */
    readonly provider: string | null
    /** When the newest line of the route was said (ISO text), or null when nothing was said. */
    readonly lastLineAt: string | null
    /** The workbench of the agent that spoke last, or null when no agent has spoken on the route. */
    readonly workbench: WorkbenchTargetView | null
    /** The member who holds the thread, or null when the agents speak on it. */
    readonly holder: RouteHolderView | null
}

/** Who spoke a line: the person, an agent, or a member of the shop. */
export type SpeakerKind = "person" | "agent" | "staff"

/** The speaker of a line, resolved on the server. */
export interface SpeakerView {
    /** Who it is. */
    readonly kind: SpeakerKind
    /** The name: the contact's display name, the agent's name, the member's name; null when none is known (or the line is the engine's own). */
    readonly name: string | null
}

/** One line of a person's conversation. */
export interface ContactMessageView {
    /** The line id. */
    readonly id: string
    /** The route it was said on. */
    readonly routeId: string
    /** The channel of the route. */
    readonly channel: string
    /** The connection of the entrance, or null. */
    readonly accountId: string | null
    /** `from_person` or `to_person`. */
    readonly direction: "from_person" | "to_person"
    /** When it was said (ISO text). */
    readonly saidAt: string
    /** The words. */
    readonly text: string
    /** The files, by address. */
    readonly files: ReadonlyArray<CustomerLineFile>
    /** The order card the line showed, or null. */
    readonly order: Readonly<Record<string, unknown>> | null
    /** Where a line said to the person stands; null for a line from the person. */
    readonly state: DeliveryState | null
    /** Who spoke it. */
    readonly speaker: SpeakerView
}

/** A page of a person's conversation, newest first. */
export interface ContactMessagesPageView {
    /** The lines. */
    readonly rows: ReadonlyArray<ContactMessageView>
    /** The cursor of the next (older) page, or null at the end. */
    readonly next: string | null
}

/** One thing an agent did for a person, in the words of the workspace. */
export interface ContactWorkView {
    /** The memory entry's id. */
    readonly id: string
    /** The workflow's title, or null when the workflow no longer exists or the entry names none. */
    readonly workflowLabel: string | null
    /** The step's title (the title its installed node declares), or null when no installed node declares one. */
    readonly stepLabel: string | null
    /** How the step ended: `done`, `failed` or `passed_over`. */
    readonly status: string
    /** The round of a loop the step ran in, or null. */
    readonly round: number | null
    /** When it ended (ISO text). */
    readonly at: string
    /** The agent that did it, or null. */
    readonly agentId: string | null
    /** The agent's name, or null. */
    readonly agentName: string | null
    /** The run, or null. */
    readonly runId: string | null
}

/** What a person asks of a person's conversation. */
export interface ReadContactMessagesRequest {
    /** The workspace the person reads in. */
    readonly workspaceId: string
    /** The contact whose conversation is read. */
    readonly contactId: string
    /** One route of the contact; absent or null reads every route. */
    readonly routeId?: string | null | undefined
    /** The cursor of the page before: only older lines come back. */
    readonly before?: string | null | undefined
    /** The most lines, 1 to 50. */
    readonly limit?: number | null | undefined
}

/** What a person asks of the routes of a contact. */
export interface ReadContactRoutesRequest {
    /** The workspace the person reads in. */
    readonly workspaceId: string
    /** The contact. */
    readonly contactId: string
}

/** What a person asks of what the agents did for a contact. */
export interface ReadContactWorkRequest {
    /** The workspace the person reads in. */
    readonly workspaceId: string
    /** The contact. */
    readonly contactId: string
    /** The language of the labels. */
    readonly locale: "vi" | "en"
    /** The most rows, 1 to 50. */
    readonly limit?: number | null | undefined
}
