import type { ReactNode } from "react"
import { SlotView, type PageFrameTabs } from "@nivo-lite/agent-sdk/client"
import { WorkbenchTabsContext } from "@/hooks/workbenchTabs"
import type { DataSlot, SlotLabels } from "@/modules/types"
import {
    Alert,
    Badge,
    Button,
    DropdownMenu,
    IconButton,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    Cluster,
    type BreadcrumbItem,
    type DropdownMenuEntry,
    type PageHeaderContent,
} from "@starci/grammar/common"
import { AgentKindMark } from "@/components/branches/AgentKindMark"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ConnectionNeeds } from "@/components/leaves/ConnectionNeeds"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { FrameSubTabs, InstanceHeaderView, InstanceSwitch } from "./parts"

export type { InstanceHeaderView, InstanceSwitch } from "./parts"
/** Copy, header view and tabs of the frame of an agent instance. */
export interface AgentInstanceFrameBaseProps {
    /** The routed tab. */
    readonly content: ReactNode
    readonly props: {
        /** The routed tab's body is panes: attached flush under the tab line instead of cards on the page ground. */
        readonly hasPanes: boolean
        readonly ariaLabel: string
        readonly earlyLabel: string
        readonly profileLabel: string
        /** A short soft notice carried by a redirect to this tab (staff sent from Setup); empty when none. */
        readonly notice: string
        /** The notice of an agent whose setup is not applied (connected block); null when the page shows none. */
        readonly setupNotice: ReactNode
        readonly moreLabel: string
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly href: string
            /** The grants on Ket noi, the waiting facts on Tri thuc; absent while unknown or when the tab has none. */
            readonly count?: number
            /** The count waits for the owner. */
            readonly isAttention?: boolean
        }>
        /** The tab the route names; the line follows a soft navigation from inside the body, which the tabs alone do not see. */
        readonly selectedTab: string
        /** The second tab row of the routed tab (the views of Work), or null for a tab with none. */
        readonly subTabs: FrameSubTabs | null
        /** The instance is not known yet: the header keeps its boxes. */
        readonly isLoading: boolean
        readonly read: DataSlot<boolean>
        readonly labels: SlotLabels
        readonly view: InstanceHeaderView
        readonly switcher: InstanceSwitch
    }
    readonly on: {
        readonly retry: () => void
        /** Takes the view tabs a routed workbench hands up for the second tab row (null when it goes). */
        readonly viewTabs: (tabs: PageFrameTabs | null) => void
    }
}

type FrameCopy = AgentInstanceFrameBaseProps["props"]

interface FrameNoticeProps {
    readonly read: DataSlot<boolean>
    readonly labels: SlotLabels
    readonly onRetry: () => void
}

/** The header read fails once beside the routed tab, which reads and fails on its own; nothing shows while it is read or ready. */
const FrameNotice = (props: FrameNoticeProps) => (
    <SlotView slot={props.read} placeholder={false} labels={props.labels} onRetry={props.onRetry} render={() => null} />
)

/** What a part of the header reads: the copy and the view of the frame. */
interface HeaderPartProps {
    readonly copy: FrameCopy
}

/** The entries of the heading's menu: the profile, the other agents (the open one checked) with the way to add one. */
const menuEntriesOf = (copy: FrameCopy): DropdownMenuEntry[] => {
    const { view, switcher } = copy
    const hasSwitch = switcher.items.length > 1 || (switcher.items.length > 0 && switcher.add !== null)
    return [
        ...(view.profileHref === null ? [] : [{ id: "profile", label: copy.profileLabel, href: view.profileHref }]),
        ...(hasSwitch
            ? [
                  {
                      kind: "section" as const,
                      id: "agents",
                      label: switcher.label,
                      selection: {
                          mode: "single" as const,
                          selectedIds: [switcher.currentId],
                          onChange: () => undefined,
                      },
                      items: switcher.items.map((item) => ({
                          id: item.id,
                          label: item.name,
                          description: item.description,
                          href: item.href,
                          mark: <AgentMark label={item.name} seed={item.seed} src={item.avatarUrl} size="sm" />,
                      })),
                  },
              ]
            : []),
        ...(switcher.add === null || !hasSwitch
            ? []
            : [
                  {
                      id: "add",
                      label: switcher.add.label,
                      href: switcher.add.href,
                      iconSource: nivoIconSource("add", "leading"),
                  },
              ]),
    ]
}

/** The commands at the end of the header: the primary command of the open tab when it has one, and a menu of the rest. */
const HeaderActions = (props: HeaderPartProps) => {
    const { copy } = props
    const entries = menuEntriesOf(copy)
    return (
        <Cluster gap="inline">
            {copy.view.primary === null ? null : (
                <Button intent="commit" href={copy.view.primary.href} startGlyph="plus">
                    {copy.view.primary.label}
                </Button>
            )}
            {entries.length === 0 ? null : (
                <DropdownMenu
                    placement="bottom end"
                    entries={entries}
                    trigger={
                        <IconButton
                            intent="neutral"
                            source={nivoIconSource("more", "leading")}
                            label={copy.moreLabel}
                        />
                    }
                />
            )}
        </Cluster>
    )
}

/** The early badge and the status of the agent beside its name. */
const HeaderStatus = (props: HeaderPartProps) => (
    <>
        {props.copy.view.isEarly ? <Badge tone="accent">{props.copy.earlyLabel}</Badge> : null}
        <Badge isDot tone={props.copy.view.statusTone}>
            {props.copy.view.statusLabel}
        </Badge>
    </>
)

/**
 * Draws the frame of an agent instance under one page band (trail, person, facts, switcher, actions, tabs). A tab whose body is
 * panes (Setup) is `Page chrome="panes"`: one grid attached flush under the tab line, its flush pane hosting the tab's own grid,
 * full width and to the viewport bottom (pane-grid.choose.page). The other tabs are cards on the page ground, never in a surface of their own.
 */
export const AgentInstanceFrameBase = (props: AgentInstanceFrameBaseProps) => {
    const copy = props.props
    const view = copy.view
    const header: PageHeaderContent = {
        breadcrumbs: { label: copy.crumbLabel, items: copy.crumbs },
        mark: <AgentKindMark module={view.module} isLoading={copy.isLoading} />,
        title: view.name,
        status: <HeaderStatus copy={copy} />,
        meta: view.subtitle,
        ...(view.needs.lines.length === 0 ? {} : { description: <ConnectionNeeds {...view.needs} /> }),
        actions: <HeaderActions copy={copy} />,
        tabs: {
            label: copy.tabsLabel,
            labelVisibility: "always",
            items: [...copy.tabs],
            selectedKey: copy.selectedTab,
        },
        ...(copy.subTabs === null ? {} : { subTabs: copy.subTabs }),
    }
    return (
        <WorkbenchTabsContext.Provider value={props.on.viewTabs}>
            {copy.hasPanes ? (
                <Page chrome="panes" measure="product" isLoading={copy.isLoading} minHeight="lg" header={header}>
                    <PaneGrid label={copy.ariaLabel} areas={["tab"]}>
                        <Pane area="tab" inset="flush">
                            <FrameNotice read={copy.read} labels={copy.labels} onRetry={props.on.retry} />
                            {copy.setupNotice === null ? null : <PaneSection>{copy.setupNotice}</PaneSection>}
                            {copy.notice === "" ? null : (
                                <PaneSection>
                                    <Alert tone="informative" title={copy.notice} />
                                </PaneSection>
                            )}
                            {props.content}
                        </Pane>
                    </PaneGrid>
                </Page>
            ) : (
                <Page measure="product" isLoading={copy.isLoading} header={header}>
                    <FrameNotice read={copy.read} labels={copy.labels} onRetry={props.on.retry} />
                    {copy.setupNotice}
                    {copy.notice === "" ? null : <Alert tone="informative" title={copy.notice} />}
                    {props.content}
                </Page>
            )}
        </WorkbenchTabsContext.Provider>
    )
}
