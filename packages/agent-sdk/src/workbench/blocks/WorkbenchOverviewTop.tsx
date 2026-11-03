import type { ReactNode } from "react"
import { Tabs } from "@starci/grammar/common"
import { FiguresStrip } from "./FiguresStrip"
import { SlotView } from "./SlotView"
import { WaitingRegion } from "./WaitingRegion"
import type { WorkbenchDashboardRegions, WorkbenchFigureRegion } from "../view/view.types"

const panelId = (id: string) => "agent-dashboard-panel-" + id

/** The decisions that wait, the figures and the strip of tabs of a workbench view. */
interface WorkbenchOverviewView {
    readonly regions: Pick<WorkbenchDashboardRegions, "waiting">
    readonly ribbon: WorkbenchFigureRegion
    readonly tabsLabel: string
    readonly selectedTab: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    /** Supporting copy for the failed read of the figures. */
    readonly loadFailedBody?: string
}

/** The commands of the head: ask again for the waiting decisions and for the figures, and choose a tab. */
interface WorkbenchOverviewActions {
    readonly retryDashboard: () => void
    readonly retryRibbon: () => void
    readonly selectTab: (key: string) => void
}

/** The head of a workbench overview with the panel of the chosen tab under it. */
interface WorkbenchOverviewTopProps {
    readonly view: WorkbenchOverviewView
    readonly on: WorkbenchOverviewActions
    readonly children: ReactNode
}

/** The head of a workbench overview: waiting decisions, figures and the tabs with the panel of the chosen one. */
export const WorkbenchOverviewTop = (props: WorkbenchOverviewTopProps): ReactNode => (
    <>
        <SlotView
            {...props.view.regions.waiting}
            onRetry={props.on.retryDashboard}
            render={(waiting, isLoading) => (
                <WaitingRegion label={props.view.regions.waiting.label} view={waiting} isLoading={isLoading} />
            )}
        />
        <SlotView
            {...props.view.ribbon}
            {...(props.view.loadFailedBody === undefined ? {} : { errorDescription: props.view.loadFailedBody })}
            onRetry={props.on.retryRibbon}
            render={(items, isLoading) => (
                <FiguresStrip label={props.view.ribbon.label} items={items} isLoading={isLoading} />
            )}
        />
        <Tabs
            label={props.view.tabsLabel}
            selectedKey={props.view.selectedTab}
            inset="none"
            labelVisibility="always"
            items={props.view.tabs}
            panelId={panelId}
            onSelect={props.on.selectTab}
        />
        <div role="tabpanel" id={panelId(props.view.selectedTab)}>
            {props.children}
        </div>
    </>
)
