import type { ReactNode } from "react"
import { Cluster, Pane, PaneGrid, PaneSection, Tabs } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import {
    FIXED_ASIDE,
    WorkbenchAsideBand,
    WorkbenchAsideTop,
    type AsideState,
} from "@/components/composites/WorkbenchAsideTop"
import { WorkbenchRegions } from "@/components/composites/WorkbenchRegions"
import { WorkbenchWhy } from "@/components/composites/WorkbenchWhy"
import { WorkbenchWhyDecision } from "@/components/composites/WorkbenchWhyDecision"
import type {
    DataSlot,
    WorkbenchDashboardRegions,
    WorkbenchExplanationView,
    WorkbenchFigureRegion,
    WorkbenchRowData,
} from "@/modules/types"

const panelId = (id: string): string => `agent-dashboard-panel-${id}`

/** What the workbench reads: the explanation of a decision, its regions and tabs. */
interface WorkbenchOverviewView {
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    /** Supporting copy for the failed read of the figures. */
    readonly loadFailedBody?: string
}

interface WorkbenchOverviewActions {
    readonly retryDashboard: () => void
    readonly retryRibbon: () => void
    readonly selectTab: (key: string) => void
    readonly closeWhy: () => void
}

/** The workbench of an agent and the parts a module draws its own way. */
interface WorkbenchOverviewProps {
    readonly view: WorkbenchOverviewView
    readonly on: WorkbenchOverviewActions
    /** The side pane's arrangement and commands; a workbench not yet wired to them shows both panes at the wide width only. */
    readonly aside?: AsideState
    readonly forbidden?: "hide" | "notice" | undefined
    readonly ribbon?: WorkbenchFigureRegion | undefined
    /** The module's own rows of waiting decisions, drawn without a card; the standard waiting region when absent. */
    readonly waiting?: ReactNode
    readonly figures?: ReactNode
    /** The waiting rows and their command: the explained decision's buttons (the commit, the edit, the rest) come from its row. */
    readonly decisions?: {
        readonly slot: DataSlot<ReadonlyArray<WorkbenchRowData>>
        readonly onCommand: (rowId: string, commandId: string) => void
    }
    /** The workbench's own commands at the end of the tabs band (its one primary command and the "..." menu). */
    readonly headEnd?: ReactNode
    /** A record opened from the work (a candidate, a post): its head and body take the side pane in place of the decisions. */
    readonly detail?: { readonly head: ReactNode; readonly body: ReactNode }
    /** The panel of the chosen tab. */
    readonly children: ReactNode
    /** Drawn under the panel, inside the work. */
    readonly after?: ReactNode
}

/** The standard waiting region, headless: its rows and its empty notice. */
const Waiting = (props: Pick<WorkbenchOverviewProps, "view" | "on">) => (
    <SlotView
        {...props.view.regions.waiting}
        onRetry={props.on.retryDashboard}
        render={(waiting, isLoading) => (
            <WaitingRegion label={props.view.regions.waiting.label} view={waiting} isLoading={isLoading} />
        )}
    />
)

/** The figures of the standard ribbon and what its read needs. */
interface FiguresProps extends Pick<WorkbenchOverviewProps, "view" | "on" | "forbidden"> {
    readonly ribbon: WorkbenchFigureRegion
}

const Figures = (props: FiguresProps) => (
    <SlotView
        {...props.ribbon}
        {...(props.forbidden === undefined ? {} : { forbidden: props.forbidden })}
        {...(props.view.loadFailedBody === undefined ? {} : { errorDescription: props.view.loadFailedBody })}
        onRetry={props.on.retryRibbon}
        render={(items, isLoading) => <FiguresStrip label={props.ribbon.label} items={items} isLoading={isLoading} />}
    />
)

/** The body of the side pane: an opened record, else the explanation of a decision, else the decisions with the three collapsed rows. */
interface AsideBodyProps {
    readonly view: WorkbenchOverviewView
    readonly on: WorkbenchOverviewActions
    readonly detail: WorkbenchOverviewProps["detail"] | undefined
    readonly decisions: WorkbenchOverviewProps["decisions"] | undefined
    readonly waiting: ReactNode | undefined
}

const AsideBody = (props: AsideBodyProps) => {
    const { view } = props
    if (props.detail !== undefined) return <>{props.detail.body}</>
    if (view.why.workItemId !== null) {
        return (
            <WorkbenchWhy
                view={view.why.view}
                labels={view.why.labels}
                decision={
                    props.decisions === undefined ? null : (
                        <WorkbenchWhyDecision
                            slot={props.decisions.slot}
                            workItemId={view.why.workItemId}
                            onCommand={props.decisions.onCommand}
                        />
                    )
                }
                isLoading={false}
            />
        )
    }
    return (
        <>
            <PaneSection scroll={{ label: view.regions.waiting.label }} gap="section">
                {props.waiting ?? <Waiting view={view} on={props.on} />}
            </PaneSection>
            <PaneSection gap="inline">
                <WorkbenchRegions regions={view.regions} onRetry={props.on.retryDashboard} />
            </PaneSection>
        </>
    )
}

/**
 * The workbench of an agent as panes (pane-grid.choose.frame): the tabs band over the work, with the figures and the chosen tab's
 * panel, and beside them the side pane: what waits for the owner, decided in place, over three collapsed rows (finished work,
 * connections, knowledge); an explanation of one decision replaces the waiting rows in the same pane and leaves the work in place. A
 * phone shows one pane, the work with a band that opens the decisions.
 */
export const WorkbenchOverview = (props: WorkbenchOverviewProps) => {
    const { view } = props
    const aside = props.aside ?? FIXED_ASIDE
    return (
        <PaneGrid
            label={props.aside === undefined ? view.tabsLabel : aside.view.copy.grid}
            areas={aside.view.grid.areas}
            columns={aside.view.grid.columns}
            rows={aside.view.grid.rows}
        >
            <Pane area="head" surface>
                <PaneSection align="center">
                    <Cluster gap="inline" justify="between" wrap={false}>
                        <Tabs
                            label={view.tabsLabel}
                            selectedKey={view.selectedTab}
                            inset="none"
                            labelVisibility="always"
                            items={view.tabs}
                            panelId={panelId}
                            onSelect={props.on.selectTab}
                        />
                        {props.headEnd}
                    </Cluster>
                </PaneSection>
            </Pane>
            <Pane area="main" scroll label={view.tabsLabel}>
                <PaneSection gap="section">
                    <WorkbenchAsideBand regions={view.regions} openLabel={view.why.openLabel} aside={props.aside} />
                    {props.figures ??
                        (props.ribbon === undefined ? null : (
                            <Figures ribbon={props.ribbon} view={view} on={props.on} forbidden={props.forbidden} />
                        ))}
                    <div role="tabpanel" id={panelId(view.selectedTab)}>
                        {props.children}
                    </div>
                    {props.after}
                </PaneSection>
            </Pane>
            <Pane area="asideHead" surface>
                {props.detail === undefined ? (
                    <WorkbenchAsideTop view={view} onCloseWhy={props.on.closeWhy} aside={aside} />
                ) : (
                    props.detail.head
                )}
            </Pane>
            <Pane area="aside" surface label={view.regions.waiting.label}>
                <AsideBody
                    view={view}
                    on={props.on}
                    detail={props.detail}
                    decisions={props.decisions}
                    waiting={props.waiting}
                />
            </Pane>
        </PaneGrid>
    )
}
