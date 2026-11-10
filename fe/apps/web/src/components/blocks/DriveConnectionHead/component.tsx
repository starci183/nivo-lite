import { Page } from "@starci/grammar/common"
import type { ReactNode } from "react"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { connectionBandOf, connectionTabsOf, providerHeaderOf } from "@/components/frames/ConnectionBand"
import type { ConnectionPageAction, ConnectionPageChip, ConnectionBandHeader } from "@/components/frames/ConnectionBand"
import type { ConnectionRefusalView, ConnectionPageTabsView } from "@/modules/types"

/** The confirmation of a disconnect. */
interface DriveDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** The words and the state of the page of the Google account. */
export interface DriveConnectionHeadBaseProps {
    /** The routed page: the open tab body, drawn under the band. */
    readonly children: ReactNode
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
        /** The one command the status needs: grant, grant again, continue the setup. */
        readonly action?: Omit<ConnectionPageAction, "onPress">
        /** Disconnect belongs to the workspace owner, once there is a grant to forget; absent otherwise. */
        readonly disconnectLabel?: string
        readonly confirm: DriveDisconnectConfirm
    }
    readonly on: {
        readonly act: () => void
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
    }
}

/** The commands behind the "more" button: disconnect, which asks first (the owner only). */
const menuOf = (props: DriveConnectionHeadBaseProps): ReadonlyArray<DropdownMenuEntry> =>
    props.props.disconnectLabel === undefined
        ? []
        : [{ id: "disconnect", label: props.props.disconnectLabel, tone: "danger", onAction: props.on.askDisconnect }]

/**
 * Draws the page of the Google account: the band (trail, mark, the email as the name, status, the services line, the one action its status needs, the
 * menu, the tabs) over the routed page, which draws the body of the open tab.
 */
export const DriveConnectionHeadBase = (props: DriveConnectionHeadBaseProps) => {
    const p = props.props
    const isRefused = p.refusal !== undefined
    const entries = menuOf(props)
    const header = providerHeaderOf(
        {
            ...p,
            title: p.refusal?.title ?? p.name,
            isRefused,
            mark: <ProviderLogo glyph="apps" src={p.markSrc} />,
            chips: [p.chip],
            menu: entries,
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
