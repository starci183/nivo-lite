import type { ReactNode } from "react"
import { Grid, Stack, Tabs } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import type { WorkbenchDashboardRegions, WorkbenchFigureRegion } from "@/modules/types"

const panelId = (id: string): string => `agent-dashboard-panel-${id}`

/** What the overview of a workbench reads: its regions, figures and tabs. */
interface WorkbenchOverviewView {
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: string
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    /** Supporting copy for the failed read of the figures. */
    readonly loadFailedBody?: string
}

/** The commands of the overview: ask again for the regions and the figures, and choose a tab. */
interface WorkbenchOverviewActions {
    readonly retryDashboard: () => void
    readonly retryRibbon: () => void
    readonly selectTab: (key: string) => void
}

/** The overview of a workbench and the parts a module draws its own way. */
interface WorkbenchOverviewProps {
    readonly view: WorkbenchOverviewView
    readonly on: WorkbenchOverviewActions
    /** How a forbidden read of the figures is drawn; the slot's own default when absent. */
    readonly forbidden?: "hide" | "notice" | undefined
    /** The standard ribbon of figures; absent when the module draws its own. */
    readonly ribbon?: WorkbenchFigureRegion | undefined
    /** The module's own waiting card; the standard waiting region when absent. */
    readonly waiting?: ReactNode
    /** The module's own figures; the standard ribbon when absent. */
    readonly figures?: ReactNode
    /** The panel of the chosen tab. */
    readonly children: ReactNode
    /** Drawn under the dashboard cards. */
    readonly after?: ReactNode
}

/** The dashboard regions and the command that asks for them again. */
interface DashboardCardsProps {
    readonly regions: WorkbenchDashboardRegions
    readonly onRetry: () => void
}

const DashboardCards = (props: DashboardCardsProps) => {
    const regions = props.regions
    return (
        <Grid kind="cards" columns={3}>
            <SlotView
                {...regions.done}
                onRetry={props.onRetry}
                render={(done, isLoading) => (
                    <DoneRegion label={regions.done.label} view={done} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.connections}
                onRetry={props.onRetry}
                render={(connections, isLoading) => (
                    <ConnectionsRegion label={regions.connections.label} view={connections} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.knowledge}
                onRetry={props.onRetry}
                render={(knowledge, isLoading) => (
                    <KnowledgeRegion label={regions.knowledge.label} view={knowledge} isLoading={isLoading} />
                )}
            />
        </Grid>
    )
}

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

/** The overview of a workbench: waiting decisions, figures, the tabs with the panel of the chosen one, and the dashboard cards. */
export const WorkbenchOverview = (props: WorkbenchOverviewProps) => (
    <Stack gap="region">
        {props.waiting ?? <Waiting view={props.view} on={props.on} />}
        {props.figures ??
            (props.ribbon === undefined ? null : (
                <Figures ribbon={props.ribbon} view={props.view} on={props.on} forbidden={props.forbidden} />
            ))}
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
        <DashboardCards regions={props.view.regions} onRetry={props.on.retryDashboard} />
        {props.after}
    </Stack>
)
