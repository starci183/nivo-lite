/** The tone a status chip of the Connections panes wears. */
export type ConnectionPaneTone = "neutral" | "success" | "warning" | "danger"

/** One connection as a row of the list pane: who it is, what identifies it, and how it is doing. */
export interface ConnectionListRow {
    readonly id: string
    readonly name: string
    /** The one line under the name: the provider and what identifies the connection on its side. */
    readonly description: string
    readonly logo: { readonly src?: string; readonly isWordmark: boolean }
    readonly status: { readonly label: string; readonly tone: ConnectionPaneTone; readonly isDot: boolean }
    /** The page of the connection when its provider has one; else the row opens in the overview pane. */
    readonly href: string | null
    /** The filter ids this row passes besides "all". */
    readonly groups: ReadonlyArray<string>
}

/** One choice of the filter row of the list pane. */
export interface ConnectionFilterChoice {
    readonly value: string
    readonly label: string
    readonly count: number
}

/** The connection that needs the owner next, as the overview card says it. */
export interface ConnectionNextStep {
    readonly id: string
    readonly name: string
    /** The title of the notice: which connection is unfinished or needs a check. */
    readonly title: string
    readonly logo: { readonly src?: string; readonly isWordmark: boolean }
    readonly status: { readonly label: string; readonly tone: ConnectionPaneTone; readonly isDot: boolean }
    /** What is wrong or still missing, and which agents it stops. */
    readonly body: string
    /** Where the one command goes; null when the viewer may not act or the connection has no page. */
    readonly action: { readonly label: string; readonly href: string } | null
}

/** One agent with the connections it works through, as the overview reads it. */
export interface ConnectionAgentRow {
    readonly id: string
    readonly name: string
    /** The connections it works through, joined. */
    readonly description: string
}

/** What the overview pane draws once the workspace reads are in. */
export interface ConnectionsOverviewView {
    /** The line under the pane title: the workspace and how many connections it holds. */
    readonly head: string
    /** The meta line of the agents figure: how many agents are running. */
    readonly agentsMeta: string
    readonly workspace: string
    readonly count: number
    readonly live: number
    readonly attention: number
    readonly agentCount: number
    readonly activeAgents: number
    readonly next: ConnectionNextStep | null
    /** The agents that work through at least one connection. */
    readonly agents: ReadonlyArray<ConnectionAgentRow>
    readonly canManage: boolean
}

/** What the list pane draws once the workspace reads are in. */
export interface ConnectionsListView {
    readonly rows: ReadonlyArray<ConnectionListRow>
    readonly filters: ReadonlyArray<ConnectionFilterChoice>
    /** The summary line of the page head: what runs and what needs the owner. */
    readonly summary: string
    readonly liveCount: number
    readonly attention: ConnectionNextStep | null
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
