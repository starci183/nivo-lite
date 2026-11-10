import { Page } from "@starci/grammar/common"
import type { ReactNode } from "react"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { connectionBandOf, connectionTabsOf, providerHeaderOf } from "@/components/frames/ConnectionBand"
import type { ConnectionPageAction, ConnectionPageChip, ConnectionBandHeader } from "@/components/frames/ConnectionBand"
import type { ConnectionPageTabsView, ConnectionRefusalView } from "@/modules/types"

/** The confirmation of a disconnect. */
interface SepayDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** The words and the state of the page of a SePay connection. */
export interface SepayConnectionHeadBaseProps {
    /** The open tab's body. */
    readonly children?: ReactNode
    readonly props: {
        readonly name: string
        readonly facts: string
        /** The status in the shared vocabulary, then the environment while it is a test. */
        readonly chips: ReadonlyArray<ConnectionPageChip>
        readonly isLoading: boolean
        /** The provider mark. */
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        readonly crumbs: ConnectionBandHeader["crumbs"]
        readonly crumbsLabel: string
        readonly tabs: ConnectionPageTabsView
        readonly moreLabel: string
        /** The one command the status needs: fix, continue the setup, connect again. */
        readonly action?: Omit<ConnectionPageAction, "onPress">
        /** Disconnect belongs to the workspace owner; absent for everyone else, whom the back end refuses. */
        readonly disconnectLabel?: string
        readonly confirm: SepayDisconnectConfirm
    }
    readonly on: {
        readonly act: () => void
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
    }
}

/** The commands behind the "more" button: disconnect, which asks first (the owner only). */
const menuOf = (props: SepayConnectionHeadBaseProps): ReadonlyArray<DropdownMenuEntry> =>
    props.props.disconnectLabel === undefined
        ? []
        : [{ id: "disconnect", label: props.props.disconnectLabel, tone: "danger", onAction: props.on.askDisconnect }]

/**
 * Draws the page of one SePay connection: the band (trail, bank mark, name, status and environment, facts, the one action its status
 * needs, the menu, the tabs) over the open tab's body.
 */
export const SepayConnectionHeadBase = (props: SepayConnectionHeadBaseProps) => {
    const p = props.props
    const isRefused = p.refusal !== undefined
    const header = providerHeaderOf(
        {
            ...p,
            title: p.refusal?.title ?? p.name,
            isRefused,
            mark: <ProviderLogo glyph="wallet" src={p.markSrc} />,
            chips: p.chips,
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
