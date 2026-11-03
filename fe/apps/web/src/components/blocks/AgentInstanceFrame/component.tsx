import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { Badge, Button, DropdownMenu, Icon, Page, Pane, PaneGrid, Cluster } from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem, PageHeaderContent } from "@starci/grammar/common"
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

interface FrameBodyProps {
    readonly body: ReactNode
    readonly read: DataSlot<boolean>
    readonly labels: SlotLabels
    readonly onRetry: () => void
}

/** The header read fails once in the Page body while its route chrome stays in place. */
const FrameBody = (props: FrameBodyProps) => (
    <SlotView
        slot={props.read}
        placeholder={false}
        labels={props.labels}
        onRetry={props.onRetry}
        render={() => props.body}
    />
)

/** What a part of the header reads: the copy and the view of the frame. */
interface HeaderPartProps {
    readonly copy: FrameCopy
}

/** The installed agents in a menu: the open one checked, a row opens another, the last entry adds one (for a person who may). */
interface SwitcherProps {
    readonly switcher: InstanceSwitch
}

const Switcher = (props: SwitcherProps) => (
    <DropdownMenu
        placement="bottom end"
        trigger={
            <Button intent="neutral" endContent={<Icon source={nivoIconSource("expand", "leading")} usage="leading" />}>
                {props.switcher.label}
            </Button>
        }
        entries={[
            {
                kind: "section",
                id: "agents",
                label: props.switcher.label,
                selection: { mode: "single", selectedIds: [props.switcher.currentId], onChange: () => undefined },
                items: props.switcher.items.map((item) => ({
                    id: item.id,
                    label: item.name,
                    description: item.description,
                    href: item.href,
                    mark: <AgentMark label={item.name} seed={item.seed} src={item.avatarUrl} size="sm" />,
                })),
            },
            ...(props.switcher.add === null
                ? []
                : [
                      {
                          id: "add",
                          label: props.switcher.add.label,
                          href: props.switcher.add.href,
                          iconSource: nivoIconSource("add", "leading"),
                      },
                  ]),
        ]}
    />
)

/** The two actions and the switcher at the end of the header. */
const HeaderActions = (props: HeaderPartProps) => {
    const { copy } = props
    return (
        <Cluster gap="inline">
            {copy.switcher.items.length > 1 || (copy.switcher.items.length > 0 && copy.switcher.add !== null) ? (
                <Switcher switcher={copy.switcher} />
            ) : null}
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
            {copy.view.profileHref === null ? null : (
                <Button intent="neutral" href={copy.view.profileHref}>
                    {copy.profileLabel}
                </Button>
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
                        <FrameBody
                            body={props.children}
                            read={copy.read}
                            labels={copy.labels}
                            onRetry={props.on.retry}
                        />
                    </Pane>
                </PaneGrid>
            </Page>
        )
    }
    return (
        <Page measure="product" isLoading={copy.isLoading} header={header}>
            <FrameBody body={props.children} read={copy.read} labels={copy.labels} onRetry={props.on.retry} />
        </Page>
    )
}
