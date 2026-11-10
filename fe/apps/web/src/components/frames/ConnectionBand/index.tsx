import type { ReactNode } from "react"
import { Badge, Button, DropdownMenu, EmptyNotice, IconButton } from "@starci/grammar/common"
import type {
    BadgeTone,
    BreadcrumbItem,
    DropdownMenuEntry,
    PageHeaderContent,
    PageHeaderTabs,
} from "@starci/grammar/common"
import { ConnectionDisconnectDialog } from "@/components/branches/ConnectionDisconnectDialog"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ConnectionRefusalView } from "@/modules/types"

/** One badge beside the connection's name: its status in the shared vocabulary, and its environment when it has one. */
export interface ConnectionPageChip {
    readonly label: string
    readonly tone: BadgeTone
    readonly isDot?: boolean
}

/** The one command a connection's status needs (grant again, send a test, continue the setup). */
export interface ConnectionPageAction {
    readonly label: string
    readonly intent: "commit" | "alternative" | "neutral"
    readonly isPending?: boolean
    readonly onPress: () => void
}

/** One tab of a connection page: overview, events, agents, settings. Each is an address, so the tabs are links. */
interface ConnectionPageTab {
    readonly id: string
    readonly label: string
    readonly href: string
    readonly count?: number
}

/** The band of a connection page: the trail, the provider mark, the name, the status, the facts line, the one action and the menu. */
export interface ConnectionBandHeader {
    readonly crumbsLabel: string
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    readonly title: string
    readonly mark: ReactNode
    readonly chips: ReadonlyArray<ConnectionPageChip>
    /** The one line under the name: the provider, its kind, what identifies it, who added it. */
    readonly facts: string
    readonly action?: ConnectionPageAction
    /** The commands beyond the one visible one (disconnect), behind the "more" button. */
    readonly menu?: { readonly label: string; readonly entries: ReadonlyArray<DropdownMenuEntry> }
    readonly tabs: {
        readonly label: string
        readonly selectedKey: string
        readonly items: ReadonlyArray<ConnectionPageTab>
    }
    /** A question the band's commands open (disconnect asks first); drawn in a portal, so it takes no room. */
    readonly question?: ReactNode
}

/** What the commands of the band read. */
interface ActionsProps {
    readonly header: ConnectionBandHeader
}

/** The commands at the end of the band: the one action, the menu, and the question they may open. */
const Actions = (props: ActionsProps) => {
    const { action, menu } = props.header
    return (
        <>
            {action === undefined ? null : (
                <Button intent={action.intent} isPending={action.isPending === true} onPress={action.onPress}>
                    {action.label}
                </Button>
            )}
            {menu === undefined || menu.entries.length === 0 ? null : (
                <DropdownMenu
                    placement="bottom end"
                    entries={[...menu.entries]}
                    trigger={
                        <IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={menu.label} />
                    }
                />
            )}
            {props.header.question}
        </>
    )
}

/**
 * The band of the one page every connection opens on, whatever its provider: the trail, the provider's mark, the name with its status
 * badge, the facts line, the one action its status needs and the menu. The head block of each provider draws its `Page` with this band
 * and `connectionTabsOf` (Overview, Events, Agents, Settings), and the tab's page draws its body under it.
 */
export const connectionBandOf = (header: ConnectionBandHeader): Omit<PageHeaderContent, "tabs"> => ({
    breadcrumbs: { label: header.crumbsLabel, items: [...header.crumbs] },
    title: header.title,
    mark: header.mark,
    status: (
        <>
            {header.chips.map((chip) => (
                <Badge key={chip.label} tone={chip.tone} isDot={chip.isDot === true}>
                    {chip.label}
                </Badge>
            ))}
        </>
    ),
    meta: header.facts,
    actions: <Actions header={header} />,
})

/** The tabs of a connection page as the band's link tabs. */
export const connectionTabsOf = (header: ConnectionBandHeader): PageHeaderTabs => ({
    label: header.tabs.label,
    selectedKey: header.tabs.selectedKey,
    items: header.tabs.items.map((tab) => ({
        id: tab.id,
        label: tab.label,
        href: tab.href,
        ...(tab.count === undefined ? {} : { count: tab.count }),
    })),
})

/** The disconnect question a provider band opens: what stops, and whether the answer is being saved. */
interface ConnectionDisconnectQuestion {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** What a provider's head resolves for its band; the shared shape of the Zalo, Telegram, SePay and Drive heads. */
interface ConnectionProviderBand {
    readonly crumbsLabel: string
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    /** The connection's name, or the refusal's title for a member who may not read the page. */
    readonly title: string
    /** A member may not read the page: the band keeps only the trail, the title and the tabs. */
    readonly isRefused: boolean
    readonly mark: ReactNode
    readonly chips: ReadonlyArray<ConnectionPageChip>
    readonly facts: string
    readonly action?: Omit<ConnectionPageAction, "onPress">
    readonly moreLabel: string
    readonly menu: ReadonlyArray<DropdownMenuEntry>
    readonly tabs: ConnectionBandHeader["tabs"]
    readonly confirm: ConnectionDisconnectQuestion
}

/** The commands a provider band hands on: its one action, and the answers of the disconnect question. */
interface ConnectionProviderBandOn {
    readonly act: () => void
    readonly confirmDisconnect: () => void
    readonly dismiss: () => void
}

/** The band of a provider's connection page from what its head resolved: refused members see the trail, the title and the tabs only. */
export const providerHeaderOf = (band: ConnectionProviderBand, on: ConnectionProviderBandOn): ConnectionBandHeader => {
    const action = band.action
    return {
        crumbsLabel: band.crumbsLabel,
        crumbs: band.crumbs,
        title: band.title,
        mark: band.mark,
        chips: band.isRefused ? [] : band.chips,
        facts: band.isRefused ? "" : band.facts,
        ...(action === undefined || band.isRefused ? {} : { action: { ...action, onPress: on.act } }),
        ...(band.isRefused || band.menu.length === 0 ? {} : { menu: { label: band.moreLabel, entries: band.menu } }),
        tabs: band.tabs,
        question: (
            <ConnectionDisconnectDialog
                confirm={band.confirm}
                onConfirm={on.confirmDisconnect}
                onDismiss={on.dismiss}
            />
        ),
    }
}

/** Why a member may not read a connection page, when they may not. */
interface ConnectionBandRefusalProps {
    readonly refusal: ConnectionRefusalView | undefined
}

/** Why a member may not read a connection page: drawn in place of its regions, nothing for anyone else. */
export const ConnectionBandRefusal = (props: ConnectionBandRefusalProps): ReactNode =>
    props.refusal === undefined ? null : (
        <EmptyNotice message={props.refusal.message} iconSource={nivoIconSource("warning", "leading")} description={props.refusal.description} />
    )
