import { Page } from "@starci/grammar/common"
import type { ReactNode } from "react"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { connectionBandOf, connectionTabsOf, providerHeaderOf } from "@/components/frames/ConnectionBand"
import type { ConnectionPageAction, ConnectionPageChip, ConnectionBandHeader } from "@/components/frames/ConnectionBand"

/** The confirmation of a disconnect. */
interface TelegramDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** The words and the state of the band of a Telegram bot connection page. */
export interface TelegramConnectionHeadBaseProps {
    /** The open tab's body, drawn by the page under the band. */
    readonly children: ReactNode
    readonly props: {
        readonly name: string
        readonly facts: string
        readonly chip: ConnectionPageChip
        readonly isLoading: boolean
        /** The provider mark. */
        readonly markSrc: string
        /** The title drawn in place of the name for a member who may not read the page. */
        readonly refusalTitle?: string
        readonly crumbs: ConnectionBandHeader["crumbs"]
        readonly crumbsLabel: string
        readonly tabs: NonNullable<ConnectionBandHeader["tabs"]>
        readonly moreLabel: string
        /** The one command the status needs: check again, send a test, continue the setup, connect again. */
        readonly action?: Omit<ConnectionPageAction, "onPress">
        readonly recheckLabel: string
        /** Disconnect belongs to the workspace owner; absent for everyone else, whom the back end refuses. */
        readonly disconnectLabel?: string
        readonly confirm: TelegramDisconnectConfirm
    }
    readonly on: {
        readonly act: () => void
        readonly recheck: () => void
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
    }
}

/** The commands behind the "more" button: check again, and disconnect, which asks first (the owner only). */
const menuOf = (props: TelegramConnectionHeadBaseProps): ReadonlyArray<DropdownMenuEntry> => [
    { id: "recheck", label: props.props.recheckLabel, onAction: props.on.recheck },
    ...(props.props.disconnectLabel === undefined
        ? []
        : [
              {
                  id: "disconnect",
                  label: props.props.disconnectLabel,
                  tone: "danger" as const,
                  onAction: props.on.askDisconnect,
              },
          ]),
]

/**
 * Draws the band of one Telegram bot connection (trail, mark, name, status, facts, the one action its status needs, the menu, the tabs)
 * around the open tab's body. It is the root of the connection's route layout.
 */
export const TelegramConnectionHeadBase = (props: TelegramConnectionHeadBaseProps) => {
    const p = props.props
    const isRefused = p.refusalTitle !== undefined
    const header = providerHeaderOf(
        {
            ...p,
            title: p.refusalTitle ?? p.name,
            isRefused,
            mark: <ProviderLogo glyph="chat" src={p.markSrc} />,
            chips: [p.chip],
            menu: menuOf(props),
            tabs: p.tabs,
        },
        props.on,
    )
    return (
        <Page
            header={{ ...connectionBandOf(header), tabs: connectionTabsOf(header) }}
            measure="product"
            isLoading={!isRefused && p.isLoading}
        >
            {props.children}
        </Page>
    )
}
