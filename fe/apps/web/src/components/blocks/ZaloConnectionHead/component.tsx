import { Page } from "@starci/grammar/common"
import type { ReactNode } from "react"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { connectionBandOf, connectionTabsOf, providerHeaderOf } from "@/components/frames/ConnectionBand"
import type { ConnectionPageAction, ConnectionPageChip, ConnectionBandHeader } from "@/components/frames/ConnectionBand"
import type { ConnectionRefusalView, ConnectionPageTabsView } from "@/modules/types"

/** The confirmation of a disconnect. */
interface ZaloDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** The words and the state of the page of a Zalo OA connection. */
export interface ZaloConnectionHeadBaseProps {
    /** The open tab's body. */
    readonly children?: ReactNode
    readonly props: {
        readonly name: string
        readonly facts: string
        readonly chip: ConnectionPageChip
        readonly isLoading: boolean
        /** The provider mark. */
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        readonly crumbs: ConnectionBandHeader["crumbs"]
        readonly crumbsLabel: string
        readonly tabs: ConnectionPageTabsView
        readonly moreLabel: string
        /** The one command the status needs: grant again, send a test, continue the setup. */
        readonly action?: Omit<ConnectionPageAction, "onPress">
        readonly recheckLabel: string
        /** Disconnect belongs to the workspace owner; absent for everyone else, whom the back end refuses. */
        readonly disconnectLabel?: string
        readonly confirm: ZaloDisconnectConfirm
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
const menuOf = (props: ZaloConnectionHeadBaseProps): ReadonlyArray<DropdownMenuEntry> => [
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
 * Draws the page of one Zalo OA connection: the band (trail, mark, name, status, facts, the one action its status needs, the menu, the
 * tabs) over the open tab's body.
 */
export const ZaloConnectionHeadBase = (props: ZaloConnectionHeadBaseProps) => {
    const p = props.props
    const isRefused = p.refusal !== undefined
    const header = providerHeaderOf(
        {
            ...p,
            title: p.refusal?.title ?? p.name,
            isRefused,
            mark: <ProviderLogo glyph="chat" src={p.markSrc} />,
            chips: [p.chip],
            menu: menuOf(props),
            tabs: { label: p.tabs.label, selectedKey: p.tabs.selected, items: p.tabs.items },
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
