import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
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
} from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem, DropdownMenuEntry, PageHeaderContent } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ConnectionNeeds, type ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import { nivoIconSource } from "@/components/leaves/Icon"
/** What the header shows once the instance is known, every word resolved. */
export interface InstanceHeaderView {
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string | null
    readonly isEarly: boolean
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** "@handle - role - channels", already joined. */
    readonly subtitle: string
    /** What a `needs_connection` agent waits for and where to connect it; no lines otherwise. */
    readonly needs: ConnectionNeedsProps
    /** The next step of an agent that is not set up: the button to Setup; null when it is set up, when the owner is already there or may not set up. */
    readonly setup: { readonly label: string; readonly href: string } | null
    /** The 1:1 chat with the agent; null while the instance has no agent. */
    readonly chatHref: string | null
    /** The profile of the agent that drives this instance; null while the instance has no agent. */
    readonly profileHref: string | null
    /** The packaging page of this agent's workflow; null for a person who may not package. */
    readonly packageHref: string | null
}

/** One installed agent the switcher in the header can open. */
export interface InstanceSwitchItem {
    readonly id: string
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string | null
    /** "role · status", already joined. */
    readonly description: string
    readonly href: string
}

/** The switcher of the installed agents: the agents, the current one, and the way to add another. */
export interface InstanceSwitch {
    readonly label: string
    readonly items: ReadonlyArray<InstanceSwitchItem>
    readonly currentId: string
    /** The way to add another agent; null for a person who may not install agents. */
    readonly add: { readonly label: string; readonly href: string } | null
}

/** Copy, header view and tabs of the frame of an agent instance. */
export interface AgentInstanceFrameBaseProps {
    /** The routed tab. */
    readonly children: ReactNode
    readonly props: {
        /** The routed tab's body is panes: attached flush under the tab line instead of cards on the page ground. */
        readonly hasPanes: boolean
        readonly ariaLabel: string
        readonly earlyLabel: string
        readonly chatLabel: string
        readonly profileLabel: string
        readonly packageLabel: string
        /** A short soft notice carried by a redirect to this tab (staff sent from Setup); empty when none. */
        readonly notice: string
        readonly moreLabel: string
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href: string }>
        /** The tab the route names; the line follows a soft navigation from inside the body, which the tabs alone do not see. */
        readonly selectedTab: string
        /** The instance is not known yet: the header keeps its boxes. */
        readonly isLoading: boolean
        readonly read: DataSlot<boolean>
        readonly labels: SlotLabels
        readonly view: InstanceHeaderView
        readonly switcher: InstanceSwitch
    }
    readonly on: { readonly retry: () => void }
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

/** The entries of the heading's menu: the profile, the other agents (the open one checked) with the way to add one, and the packaging. */
const menuEntriesOf = (copy: FrameCopy): DropdownMenuEntry[] => {
    const { view, switcher } = copy
    const hasSwitch = switcher.items.length > 1 || (switcher.items.length > 0 && switcher.add !== null)
    return [
        ...(view.profileHref === null ? [] : [{ id: "profile", label: copy.profileLabel, href: view.profileHref }]),
        ...(view.packageHref === null ? [] : [{ id: "package", label: copy.packageLabel, href: view.packageHref }]),
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

/** The commands at the end of the header: the next setup step when one is owed, the private chat, and a menu of the rest. */
const HeaderActions = (props: HeaderPartProps) => {
    const { copy } = props
    const entries = menuEntriesOf(copy)
    return (
        <Cluster gap="inline">
            {copy.view.setup === null ? null : (
                <Button intent="commit" href={copy.view.setup.href}>
                    {copy.view.setup.label}
                </Button>
            )}
            {copy.view.chatHref === null ? null : (
                <Button intent="neutral" href={copy.view.chatHref}>
                    {copy.chatLabel}
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
        mark: (
            <AgentMark
                label={view.name}
                seed={view.seed}
                src={view.avatarUrl}
                size="control"
                isLoading={copy.isLoading}
            />
        ),
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
    }
    if (copy.hasPanes) {
        return (
            <Page chrome="panes" measure="product" isLoading={copy.isLoading} minHeight="lg" header={header}>
                <PaneGrid label={copy.ariaLabel} areas={["tab"]}>
                    <Pane area="tab" inset="flush">
                        <FrameNotice read={copy.read} labels={copy.labels} onRetry={props.on.retry} />
                        {copy.notice === "" ? null : (
                            <PaneSection>
                                <Alert tone="informative" title={copy.notice} />
                            </PaneSection>
                        )}
                        {props.children}
                    </Pane>
                </PaneGrid>
            </Page>
        )
    }
    return (
        <Page measure="product" isLoading={copy.isLoading} header={header}>
            <FrameNotice read={copy.read} labels={copy.labels} onRetry={props.on.retry} />
            {copy.notice === "" ? null : <Alert tone="informative" title={copy.notice} />}
            {props.children}
        </Page>
    )
}
