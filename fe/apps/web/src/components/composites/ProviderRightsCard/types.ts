import type { DropdownMenuEntry } from "@starci/grammar/common"

/** One option of the mode pill. */
export interface ModeOption {
    readonly id: string
    readonly label: string
}

/** The mode control at a row's end (two options, one selected). */
export interface CapabilityModeView {
    readonly label: string
    readonly value: string
    readonly options: readonly [ModeOption, ModeOption]
    readonly onChange: (value: string) => void
}

/** One capability row of a provider card. */
export interface CapabilityRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string | undefined
    readonly isOn: boolean
    readonly isDisabled: boolean
    /** Only a write capability has a mode. */
    readonly mode: CapabilityModeView | undefined
}

/** The more-menu of a provider card (remove from agent). */
export interface ProviderMenuView {
    readonly label: string
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The head of a provider card: logo, name, the kind line, and the menu or the link to connect it. */
export interface ProviderHeadView {
    readonly name: string
    readonly logo: string | undefined
    readonly line: string
    readonly menu: ProviderMenuView | undefined
    /** Set when the provider is attached but not connected: the card shows only this link. */
    readonly connectLink: { readonly label: string; readonly href: string } | undefined
}

/** One provider card: its head, then its capabilities, or a link to connect it. */
export interface ProviderRightsCardProps {
    readonly props: ProviderHeadView & {
        readonly rows: ReadonlyArray<CapabilityRowView>
    }
    readonly on: {
        readonly toggle: (rowId: string, isOn: boolean) => void
    }
}
