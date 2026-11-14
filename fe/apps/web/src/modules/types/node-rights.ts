import type { DataSlot } from "./slot"

/** The one mode a workflow node declares for the tools it calls: on its own, or after a person was asked in /chat (rights.md). */
export type NodeRightMode = "auto" | "ask"

/** One operation a provider offers (a tool, a pinned API operation), as every rights screen names it. */
export interface NodeRightOperationView {
    readonly id: string
    /** The bilingual title in the reader's language; null → draw `id` alone. */
    readonly title: string | null
    /** `GET /services/expiring` for an API operation; null for a native tool. */
    readonly endpoint: string | null
    readonly isWrite: boolean
    /** The provider's display mark in words (money, irreversible); null when none is declared. It never changes a mode. */
    readonly effectLabel: string | null
    /** The one chip a rights row shows: read, write with its mode, money (the node's mode included when known). */
    readonly chip: string
}

/** One account the agent is attached to, as the agent › rights card and the node panel's choices list it. */
export interface AgentRightAccountView {
    readonly connectionId: string
    readonly provider: string
    /** The provider in words ("SePay", "Zalo OA") from the provider catalogue; the key when the catalogue does not know it. */
    readonly providerName: string
    /** The provider's logo from the catalogue; null when it has none. */
    readonly logoSrc: string | null
    readonly kind: string | null
    readonly name: string
    /** the count of steps in use. */
    readonly stepsLine: string
    readonly stepsUsing: number
    /** What its provider offers: the node panel ticks among these. */
    readonly operations: ReadonlyArray<NodeRightOperationView>
}

/** Where a right is used: agent › workflow › step, with the address of the step. */
export interface RightPlaceView {
    readonly agentId: string
    readonly agentName: string | null
    readonly workflowKey: string
    readonly workflowName: string
    readonly nodeKey: string
    /** The step's registry key. */
    readonly step: string
    /** The step's label from the step registry (as the canvas names it); the node key when the registry has no card for it. */
    readonly stepLabel: string
    /** workflow name › step label: the workflow name and the step label. */
    readonly line: string
    /** The step's page (the workflow map with this step open); null while the agent's address is not known. */
    readonly href: string | null
}

/** One row of the agent roll-up what the agent's steps call (read-only). */
export interface AgentRightRowView {
    readonly id: string
    readonly connectionId: string
    readonly operation: NodeRightOperationView
    /** The mode of the node that calls it. */
    readonly mode: NodeRightMode
    readonly place: RightPlaceView
}

/** One agent's node rights: its accounts, the roll-up rows, and which model decides. */
export interface AgentNodeRightsView {
    readonly agentId: string
    readonly accounts: ReadonlyArray<AgentRightAccountView>
    readonly rows: ReadonlyArray<AgentRightRowView>
}

/** One holder of a provider right: a step of a workflow of an agent, in the node's mode. */
export interface RightHolderView {
    readonly id: string
    readonly mode: NodeRightMode
    /** agent name · mode. */
    readonly chip: string
    readonly place: RightPlaceView
}

/** One row of the provider › rights group rights for agents. */
export interface ProviderToolRightView {
    readonly id: string
    readonly operation: NodeRightOperationView
    /** false = not open: the plugin does not expose this operation (the row is muted). */
    readonly isOpen: boolean
    readonly holders: ReadonlyArray<RightHolderView>
    /** The line a row with no holder shows (no step calls it, or not open); null when it has holders. */
    readonly emptyLine: string | null
}

/** One row of rights to view on screens. */
export interface ProviderScreenRightView {
    readonly id: string
    readonly name: string
    readonly summary: string | null
    /** every member while every member may view. */
    readonly audience: string
}

/** One row of rights over triggers. */
export interface ProviderTriggerRightView {
    readonly id: string
    readonly name: string
    readonly summary: string
    /** agent · decider, agent · notice. */
    readonly holders: ReadonlyArray<{
        readonly id: string
        readonly chip: string
        readonly agentId: string
        /** The step the trigger starts, by its title, linking to it; null when the server names no step. */
        readonly place: RightPlaceView | null
    }>
}

/** The provider › rights tab: three groups, the server counts of the filter tabs, and the model that decides. */
export interface ProviderRightHoldersView {
    readonly counts: { readonly all: number; readonly held: number; readonly unheld: number; readonly writes: number }
    readonly tools: ReadonlyArray<ProviderToolRightView>
    readonly screens: ReadonlyArray<ProviderScreenRightView>
    readonly triggers: ReadonlyArray<ProviderTriggerRightView>
}

/** A read of node rights for one screen: its slot and its retry. */
export interface NodeRightsRead<T> {
    readonly slot: DataSlot<T>
    readonly retry: () => void
}
