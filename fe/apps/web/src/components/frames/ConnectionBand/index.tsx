import type { ReactNode } from "react"
import {
    Badge,
    Button,
    DropdownMenu,
    EmptyNotice,
    IconButton,
    type BadgeTone,
    type BreadcrumbItem,
    type DropdownMenuEntry,
    type PageHeaderContent,
    type PageHeaderTabs,
} from "@starci/grammar/common"
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
    readonly isDisabled?: boolean
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
    /** Commands after the one action, in order (Test connection, then Save: the page's one red command goes last). */
    readonly extras?: ReadonlyArray<ConnectionPageAction>
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
    const { action, extras, menu } = props.header
    return (
        <>
            {action === undefined ? null : (
                <Button intent={action.intent} isPending={action.isPending === true} onPress={action.onPress}>
                    {action.label}
                </Button>
            )}
            {(extras ?? []).map((extra) => (
                <Button
                    key={extra.label}
                    intent={extra.intent}
                    isPending={extra.isPending === true}
                    isDisabled={extra.isDisabled === true}
                    onPress={extra.onPress}
                >
                    {extra.label}
                </Button>
            ))}
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
    status: header.chips.map((chip) => (
        <Badge key={chip.label} tone={chip.tone} isDot={chip.isDot === true}>
            {chip.label}
        </Badge>
    )),
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

/** Why a member may not read a connection page, when they may not. */
interface ConnectionBandRefusalProps {
    readonly refusal: ConnectionRefusalView | undefined
}

/** Why a member may not read a connection page: drawn in place of its regions, nothing for anyone else. */
export const ConnectionBandRefusal = (props: ConnectionBandRefusalProps): ReactNode =>
    props.refusal === undefined ? null : (
        <EmptyNotice message={props.refusal.message} iconSource={nivoIconSource("warning", "leading")} description={props.refusal.description} />
    )
