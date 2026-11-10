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

/** One capability row of an account card. */
export interface CapabilityRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string | undefined
    readonly isOn: boolean
    readonly isDisabled: boolean
    /** Only a write capability has a mode. */
    readonly mode: CapabilityModeView | undefined
}

/** The more-menu of an account card (remove from agent). */
export interface ProviderMenuView {
    readonly label: string
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The head of an account card: logo, "<provider> · <account>", the kind line, a chip, and the menu or the link to connect it. */
export interface ProviderHeadView {
    readonly name: string
    /** One chip beside the name, e.g. "default receiving" on the shop's default receiving account. */
    readonly badge: string | undefined
    readonly logo: string | undefined
    readonly line: string
    readonly menu: ProviderMenuView | undefined
    /** Set when the account is attached but no longer connected: the card shows only this link. */
    readonly connectLink: { readonly label: string; readonly href: string } | undefined
}

/** One account card: its head, then the capabilities of its provider, or a link to connect it. */
export interface ProviderRightsCardProps {
    readonly props: ProviderHeadView & {
        readonly rows: ReadonlyArray<CapabilityRowView>
    }
    readonly on: {
        readonly toggle: (rowId: string, isOn: boolean) => void
    }
}
