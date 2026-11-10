import type { ProviderRightsCardProps } from "@/components/composites/ProviderRightsCard"

/** One group of account cards under its small label (messaging, payments, books). */
export interface ProviderGroupView {
    readonly id: string
    readonly label: string
    readonly cards: ReadonlyArray<{ readonly id: string; readonly card: ProviderRightsCardProps }>
}

/** One connected account the agent could still be given: "<provider> · <account>", the consequence line, the provider mark. */
export interface AttachOptionView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
    readonly name: string
    readonly logo: string | undefined
}

/** The drawer that attaches one more account: one row per connected account not attached, each with its own "Attach". */
export interface AttachDrawerView {
    readonly isOpen: boolean
    readonly title: string
    readonly closeLabel: string
    readonly options: ReadonlyArray<AttachOptionView>
    readonly optionsLabel: string
    readonly emptyLabel: string
    readonly attachLabel: string
}

/** The confirm of removing an account from the agent. */
export interface DetachView {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirm: string
    readonly cancel: string
}

/** The owner's grant on one of the agent's own "acts" tools: automatic, ask, or blocked. */
export interface ToolGrantView {
    readonly label: string
    readonly value: string
    readonly options: readonly [
        { readonly id: string; readonly label: string },
        { readonly id: string; readonly label: string },
        { readonly id: string; readonly label: string },
    ]
    readonly isDisabled: boolean
    readonly onChange: (value: string) => void
}

/** One tool the agent may call: its name, the 12 line under it (what it does, the accounts it goes through, or why it is not usable), "acts"/"reads", and the grant. */
export interface ToolRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
    readonly chip: string
    readonly isReady: boolean
    readonly grant: ToolGrantView | undefined
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

/** The rights tab of one agent: the accounts it holds with what it may do through each, then the NIVO tools it may call. */
export interface AgentConnectionsBaseProps {
    readonly props: {
        readonly paneLabel: string
        readonly title: string
        readonly attachLabel: string
        readonly groups: ReadonlyArray<ProviderGroupView>
        readonly emptyLabel: string
        readonly drawer: AttachDrawerView
        readonly detach: DetachView
        /** Undefined while the tools are read, when the read failed, or when the agent has none: the section is left out. */
        readonly tools: NivoToolsView | undefined
    }
    readonly on: {
        readonly openDrawer: () => void
        readonly closeDrawer: () => void
        readonly attach: (connectionId: string) => void
        readonly cancelDetach: () => void
        readonly confirmDetach: () => void
    }
}
