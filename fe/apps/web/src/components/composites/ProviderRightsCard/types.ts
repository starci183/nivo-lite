import type { DropdownMenuEntry } from "@starci/grammar/common"

/** The more-menu of an account card (remove from agent). */
export interface ProviderMenuView {
    readonly label: string
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The head of an account card: logo, "<provider> · <account>", the kind line, and the menu or the link to connect it. */
export interface ProviderHeadView {
    readonly name: string
    readonly logo: string | undefined
    readonly line: string
    readonly menu: ProviderMenuView | undefined
    /** Set when the account is attached but no longer connected: the card shows only this link. */
    readonly connectLink: { readonly label: string; readonly href: string } | undefined
}

/** One account card: its head, then the one row that attaches the agent to the account (an attachment holds no tick and no mode). */
export interface ProviderRightsCardProps {
    readonly props: ProviderHeadView & {
        /** The one checkbox row of the card. */
        readonly attach: { readonly label: string; readonly isOn: boolean }
    }
    readonly on: {
        readonly toggle: (isOn: boolean) => void
    }
}
