/** The tone a status chip of the Connections panes wears. */
export type ConnectionPaneTone = "neutral" | "success" | "warning" | "danger"

/** One connection as a row of the list: who it is, how it is doing, its last event and the agents that work through it. */
export interface ConnectionListRow {
    readonly id: string
    readonly name: string
    /** The one line under the name: the provider, what identifies the connection on its side, and the setup step while it is set up. */
    readonly description: string
    readonly logo: { readonly src?: string; readonly isWordmark: boolean }
    readonly status: { readonly label: string; readonly tone: ConnectionPaneTone; readonly isDot: boolean }
    /** The connection's own page: its provider page, or the generic page of a provider without one. */
    readonly href: string
    /** The filter ids this row passes besides "all". */
    readonly groups: ReadonlyArray<string>
    /** When its last event came, as an ISO date; null when none has come yet. */
    readonly lastEventAt: string | null
    /** The connection stopped on a failure: the last event column says so. */
    readonly isFailed: boolean
    /** The agents that work through it, joined; empty when none does. */
    readonly agents: string
}

/** One choice of the filter row of the list. */
export interface ConnectionFilterChoice {
    readonly value: string
    readonly label: string
    readonly count: number
}

/** One connection that needs the owner, as the "Needs you" card says it: what is wrong or missing, and its one action. */
export interface ConnectionNextStep {
    readonly id: string
    readonly name: string
    /** The title of the row: which connection and what happened. */
    readonly title: string
    readonly logo: { readonly src?: string; readonly isWordmark: boolean }
    readonly status: { readonly label: string; readonly tone: ConnectionPaneTone; readonly isDot: boolean }
    /** What is wrong or still missing, and which agents it stops. */
    readonly body: string
    /** The one command; null when the viewer may not act. `isPrimary` marks the fix of a failure. */
    readonly action: { readonly label: string; readonly href: string; readonly isPrimary: boolean } | null
}

/** The health figures of the Connections page. */
export interface ConnectionsFigures {
    readonly total: number
    readonly running: number
    readonly waiting: number
    readonly attention: number
    readonly agentsUsing: number
    readonly agentsTotal: number
}

/** What the Connections page draws once the workspace reads are in. */
export interface ConnectionsListView {
    readonly rows: ReadonlyArray<ConnectionListRow>
    readonly filters: ReadonlyArray<ConnectionFilterChoice>
    /** The summary line of the page head: what runs, what waits and what needs the owner. */
    readonly summary: string
    readonly liveCount: number
    /** Every connection that needs the owner, failures first. */
    readonly attention: ReadonlyArray<ConnectionNextStep>
    readonly figures: ConnectionsFigures
    /** The owner adds and changes connections; everyone else reads. */
    readonly canManage: boolean
}

/** One agent of a connection with its level through it. */
export interface ConnectionGrantRowView {
    readonly id: string
    readonly name: string
    /** The accessible name of its level picker. */
    readonly levelLabel: string
    readonly level: string
}

/** The agents-of-a-connection section of a connection's page: who works through it, how far, and who could be given it. */
export interface ConnectionGrantsView {
    /** Only the owner changes a level. */
    readonly canManage: boolean
    /** The picker's choices: read only, ask first, act, remove. */
    readonly levels: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly rows: ReadonlyArray<ConnectionGrantRowView>
    /** Agents that can work through this connection and do not yet. */
    readonly candidates: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** The one life every connection walks: not connected, setting up, waiting for the first event, running, needing the owner, disconnected. */
export interface ConnectionLifecycle {
    readonly id: "unconnected" | "setup" | "waiting" | "running" | "attention" | "disconnected"
    /** The phase of the setup (1 to 4) while it is set up or waits for its first event. */
    readonly phase?: number
}

/** The status badge of a step of the life, worded in the one vocabulary of the Connections screens. */
export interface ConnectionLifecycleChip {
    readonly label: string
    readonly tone: ConnectionPaneTone
    readonly isDot: boolean
}
