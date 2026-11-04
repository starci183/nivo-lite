import type { ReactNode } from "react"
import { Pane, PaneGrid, PaneSection, Tabs } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import { WorkbenchAsideBand, WorkbenchAsideTop } from "@/components/composites/WorkbenchAsideTop"
import { WorkbenchRegions } from "@/components/composites/WorkbenchRegions"
import { WorkbenchWhy } from "@/components/composites/WorkbenchWhy"
import type {
    WorkbenchAsideActions,
    WorkbenchAsideView,
    WorkbenchDashboardRegions,
    WorkbenchExplanationView,
    WorkbenchFigureRegion,
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

/** The commands of the workbench: ask again for the regions and the figures, choose a tab, close the explanation. */
interface WorkbenchOverviewActions {
    readonly retryDashboard: () => void
    readonly retryRibbon: () => void
    readonly selectTab: (key: string) => void
    readonly closeWhy: () => void
}

/** The side pane's state and commands, which the connected owner resolves from the address. */
interface WorkbenchAside {
    readonly view: WorkbenchAsideView
    readonly on: WorkbenchAsideActions
}

/** The workbench of an agent and the parts a module draws its own way. */
interface WorkbenchOverviewProps {
    readonly view: WorkbenchOverviewView
    readonly on: WorkbenchOverviewActions
    /** The side pane's arrangement and commands; a workbench not yet wired to them shows both panes at the wide width only. */
    readonly aside?: WorkbenchAside
    /** How a forbidden read of the figures is drawn; the slot's own default when absent. */
    readonly forbidden?: "hide" | "notice" | undefined
    /** The standard ribbon of figures; absent when the module draws its own. */
    readonly ribbon?: WorkbenchFigureRegion | undefined
    /** The module's own rows of waiting decisions, drawn without a card; the standard waiting region when absent. */
    readonly waiting?: ReactNode
    /** The module's own figures; the standard ribbon when absent. */
    readonly figures?: ReactNode
    /** The decision buttons of the explained decision (the commit, the edit, the rest); none draws only the way to the map. */
    readonly whyDecision?: ReactNode
    /** The panel of the chosen tab. */
    readonly children: ReactNode
    /** Drawn under the panel, inside the work. */
    readonly after?: ReactNode
}

/** The arrangement and the words of a workbench that does not resolve the side pane's state yet: both panes from the wide width, no way to close either. */
const FIXED_ASIDE: WorkbenchAside = {
    view: {
        grid: {
            areas: { base: ["head", "main"], medium: ["head", "main"], wide: ["head asideHead", "main aside"] },
            columns: { base: ["fill"], medium: ["fill"], wide: ["fill", "standard"] },
            rows: { base: ["auto", "fill"], medium: ["auto", "fill"], wide: ["auto", "fill"] },
        },
        isHidden: false,
        copy: { grid: "-", close: "-", back: "-" },
    },
    on: { open: () => undefined, close: () => undefined },
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
                    <Tabs
                        label={view.tabsLabel}
                        selectedKey={view.selectedTab}
                        inset="none"
                        labelVisibility="always"
                        items={view.tabs}
                        panelId={panelId}
                        onSelect={props.on.selectTab}
                    />
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
                <WorkbenchAsideTop view={view} onCloseWhy={props.on.closeWhy} aside={aside} />
            </Pane>
            <Pane area="aside" surface label={view.regions.waiting.label}>
                {view.why.workItemId === null ? (
                    <>
                        <PaneSection scroll={{ label: view.regions.waiting.label }} gap="section">
                            {props.waiting ?? <Waiting view={view} on={props.on} />}
                        </PaneSection>
                        <PaneSection gap="inline">
                            <WorkbenchRegions regions={view.regions} onRetry={props.on.retryDashboard} />
                        </PaneSection>
                    </>
                ) : (
                    <WorkbenchWhy
                        view={view.why.view}
                        labels={view.why.labels}
                        decision={props.whyDecision ?? null}
                        isLoading={false}
                    />
                )}
            </Pane>
        </PaneGrid>
    )
}
