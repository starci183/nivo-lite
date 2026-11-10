import type { ProviderRightsCardProps } from "@/components/composites/ProviderRightsCard"

/** One group of provider cards under its small label (messaging, payments, books). */
export interface ProviderGroupView {
    readonly id: string
    readonly label: string
    readonly cards: ReadonlyArray<{ readonly id: string; readonly card: ProviderRightsCardProps }>
}

/** One provider the agent could still be given. */
export interface AttachOptionView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
}

/** The NIVO tools choice card. */
export interface NivoToolsView {
    readonly title: string
    readonly linkLabel: string
    readonly linkHref: string
    readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly subtitle: string; readonly isOn: boolean }>
    readonly isDisabled: boolean
}

/** The drawer that attaches one more provider. */
export interface AttachDrawerView {
    readonly isOpen: boolean
    readonly title: string
    readonly closeLabel: string
    readonly options: ReadonlyArray<AttachOptionView>
    readonly optionsLabel: string
    readonly pickedId: string | null
    readonly emptyLabel: string
    readonly cancelLabel: string
    readonly submitLabel: string
}

/** The confirm of removing a provider from the agent. */
export interface DetachView {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirm: string
    readonly cancel: string
}

/** The rights tab of one agent: the providers it holds with what it may do through each, then the NIVO tools. */
export interface AgentConnectionsBaseProps {
    readonly props: {
        readonly paneLabel: string
        readonly title: string
        readonly attachLabel: string
        readonly groups: ReadonlyArray<ProviderGroupView>
        readonly emptyLabel: string
        readonly tools: NivoToolsView
        readonly drawer: AttachDrawerView
        readonly detach: DetachView
    }
    readonly on: {
        readonly openDrawer: () => void
        readonly closeDrawer: () => void
        readonly pickAttach: (id: string) => void
        readonly submitAttach: () => void
        readonly cancelDetach: () => void
        readonly confirmDetach: () => void
        readonly toggleTool: (tool: string, isOn: boolean) => void
    }
}

