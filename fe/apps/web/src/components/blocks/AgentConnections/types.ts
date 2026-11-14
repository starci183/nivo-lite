import type { ReactNode } from "react"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The confirm of removing an account from the agent. */
export interface DetachView {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirm: string
    readonly cancel: string
}

/** One tool the agent may call: its name, the 12 line under it (what it does, the accounts it goes through, or why it is not usable), "acts"/"reads". */
export interface ToolRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
    readonly chip: string
    readonly isReady: boolean
}

/** One origin group of tools under its small label. */
export interface ToolGroupView {
    readonly id: string
    readonly label: string
    readonly rows: ReadonlyArray<ToolRowView>
}

/** The "NIVO tools" section: its label with the count, the head link to the rules in the Second Brain, the groups. */
export interface NivoToolsView {
    readonly title: string
    readonly count: number
    readonly linkLabel: string
    readonly linkHref: string
    readonly groups: ReadonlyArray<ToolGroupView>
    readonly emptyLabel: string
}

/** One row of the card "accounts this agent may use": an attached account with its steps line, or a connected one not attached yet. */
export interface AccountRowView {
    readonly id: string
    /** The account's own name ("CRM NIVO Web", "support@nivo.example"). */
    readonly name: string
    /** provider and steps in use when attached, provider and not attached when not. */
    readonly line: string
    readonly logo: string | undefined
    readonly isAttached: boolean
}

/** The accounts of the account card (attached first, then the ones left to attach). */
export interface RightsPageView {
    readonly accounts: ReadonlyArray<AccountRowView>
    /** How many of the accounts are attached: the count chip of the card. */
    readonly attachedCount: number
}

/** The words of the account card. */
export interface AccountsCardCopy {
    readonly title: string
    readonly note: string
    readonly attach: string
    readonly detach: string
    readonly empty: string
}

/** The rights tab of one agent: the accounts it holds, the roll-up of what its steps call, then the NIVO tools it may call. */
export interface AgentConnectionsBaseProps {
    readonly props: {
        readonly paneLabel: string
        /** The read of the account card; loading draws its shape with skeleton data. */
        readonly read: {
            readonly slot: DataSlot<RightsPageView>
            readonly placeholder: RightsPageView
            readonly labels: SlotLabels
        }
        readonly accountsCard: AccountsCardCopy
        /** True while the accounts board is still read. */
        readonly isBoardLoading: boolean
        /** The read-only roll-up of what the steps call (its own block), shown under the accounts. */
        readonly rollup: ReactNode
        readonly detach: DetachView
        /** Undefined while the tools are read, when the read failed, or when the agent has none: the section is left out. */
        readonly tools: NivoToolsView | undefined
    }
    readonly on: {
        readonly attach: (connectionId: string) => void
        readonly askDetach: (connectionId: string) => void
        readonly retry: () => void
        readonly cancelDetach: () => void
        readonly confirmDetach: () => void
    }
}
