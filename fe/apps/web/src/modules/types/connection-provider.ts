import type { ConnectionListRow } from "./connections-panes"

/** One key figure of a provider page: what it measures, its value and the line under it. */
export interface ConnectionProviderFigure {
    readonly id: string
    readonly term: string
    readonly value: string | number
    readonly meta?: string
}

/** One line of the "About the provider" card. */
export interface ConnectionProviderAbout {
    readonly id: string
    readonly term: string
    readonly description: string
}

/** The band of a provider page: known without the connections, so it draws while they are read. */
export interface ConnectionProviderHead {
    readonly title: string
    /** The provider's mark; absent for a provider without artwork. */
    readonly markSrc?: string
    /** The line under the title: the group and how many connections the provider holds. */
    readonly meta: string
    /** The unit-specific command ("Add bot"); its href opens the wizard on the hub. */
    readonly addLabel: string
    readonly addHref: string
}

/** One agent granted a connection, in the words of the agent's Connections tab: its name, what it uses the connection for and its level. */
export interface ConnectionAgentUse {
    /** The grant: one row per agent and purpose. */
    readonly id: string
    readonly name: string
    /** The module key of the agent, which picks its kind mark. */
    readonly module: string
    readonly purpose: string
    readonly level: string
    readonly tone: "neutral" | "accent" | "warning"
}

/** One connection of a provider page with the agents that use it. */
export interface ConnectionProviderRow extends ConnectionListRow {
    readonly uses: ReadonlyArray<ConnectionAgentUse>
}

/** What the body of a provider page draws once the connections are read. */
export interface ConnectionProviderView {
    readonly canAdd: boolean
    readonly figures: ReadonlyArray<ConnectionProviderFigure>
    readonly rows: ReadonlyArray<ConnectionProviderRow>
    /** The list card's count, e.g. "3". */
    readonly count: string
    readonly about: ReadonlyArray<ConnectionProviderAbout>
}
