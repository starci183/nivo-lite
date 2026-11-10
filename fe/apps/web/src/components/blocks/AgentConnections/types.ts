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

/** The rights tab of one agent: the accounts it holds with what it may do through each. */
export interface AgentConnectionsBaseProps {
    readonly props: {
        readonly paneLabel: string
        readonly title: string
        readonly attachLabel: string
        readonly groups: ReadonlyArray<ProviderGroupView>
        readonly emptyLabel: string
        readonly drawer: AttachDrawerView
        readonly detach: DetachView
    }
    readonly on: {
        readonly openDrawer: () => void
        readonly closeDrawer: () => void
        readonly attach: (connectionId: string) => void
        readonly cancelDetach: () => void
        readonly confirmDetach: () => void
    }
}
