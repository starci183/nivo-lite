import { Grid, Stack, Tabs } from "@starci/grammar/common"
import { ShiftsWeek } from "@/components/frames/ShiftsWeek"
import { ShiftsSetup } from "@/components/frames/ShiftsSetup"
import { ShiftsMyRoster } from "@/components/frames/ShiftsMyRoster"
import { ShiftsPersonalRequests } from "@/components/frames/ShiftsPersonalRequests"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ShiftsFigures } from "@/components/composites/ShiftsFigures"
import { ShiftsRequests } from "@/components/composites/ShiftsRequests"
import { ShiftsQuickImport } from "@/components/composites/ShiftsQuickImport"
import type {
    ShiftsWorkbenchData,
    ShiftsWorkbenchOn,
    ShiftsWeekViews,
    ShiftsSetupViews,
    ShiftsRequestViews,
    ShiftsPersonalViews,
} from "@/modules/types"
/** The existing five panels and recorded explanation arrangement. */
export const SHIFTS_WORKBENCH_SHAPES = ["week", "requests", "setup", "quick", "mine", "explanation"] as const
/** Pure atoms, actual read payloads and separate initiating event handlers. */
export interface ShiftsWorkbenchBaseProps {
    readonly shape: (typeof SHIFTS_WORKBENCH_SHAPES)[number]
    readonly props: ShiftsWorkbenchData
    readonly on: ShiftsWorkbenchOn
}
const FIGURES_EMPTY: ShiftsWeekViews["figuresData"] = { isVisible: true, staffNotice: null, stats: [] }
const WEEK_EMPTY: ShiftsWeekViews["weekReady"] = {
    isVisible: true,
    weekBar: {
        weekLabel: "",
        status: { tone: "neutral", label: "" },
        isDraft: false,
        canPublish: false,
        empty: null,
        waiting: null,
    },
    weekStats: { ariaLabel: "", stats: [], lines: [], source: null, hasExplanation: false },
    coverage: { days: [] },
    grid: { hint: "", editable: false, dates: [], rows: [], selectedDay: "", dayShifts: [], assignOptions: [] },
}
const SETUP_EMPTY: ShiftsSetupViews["setupReady"] = {
    isVisible: true,
    positions: { positions: [] },
    staff: { people: [], positionOptions: [], linkOptions: [] },
    demand: {
        groups: [],
        positionOptions: [],
        form: { days: [], start: "", end: "", positionId: "", min: 0, ideal: 0, peak: false },
        hasBlocks: false,
        canAdd: false,
    },
    availability: { fields: [], rows: [], canSubmit: false },
    rules: { reminderLabel: "", reminderHint: "", reminderOn: false, fields: [], days: [] },
}
const REQUESTS_EMPTY: ShiftsRequestViews["requestsReady"] = { isVisible: true, requests: { sections: [], recent: [] } }
const QUICK_EMPTY: ShiftsSetupViews["quickReady"] = { isVisible: true, quickImport: {} }
const ROSTER_EMPTY: ShiftsPersonalViews["rosterReady"] = {
    isVisible: true,
    myShifts: { notice: null, shifts: [], swapOptions: [] },
    openShifts: { shifts: [] },
}
const PERSONAL_EMPTY: ShiftsPersonalViews["personalReady"] = {
    isVisible: true,
    leave: { fields: [], rows: [] },
    myAvailability: { fields: [], rows: [] },
    mySwaps: { rows: [] },
}
const panelId = (id: string): string => `agent-dashboard-panel-${id}`
type ShiftsPanelProps = Pick<ShiftsWorkbenchBaseProps, "props" | "on">

const MinePanel = (props: ShiftsPanelProps) => {
    const view = props.props
    return (
        <Stack gap="section">
            <SlotView
                {...view.roster}
                placeholder={ROSTER_EMPTY}
                onRetry={props.on.retryRoster}
                render={(data, isLoading) => (
                    <ShiftsMyRoster {...data} copy={view.roster.copy} on={props.on} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...view.personal}
                placeholder={PERSONAL_EMPTY}
                onRetry={props.on.retryMine}
                render={(data, isLoading) => (
                    <ShiftsPersonalRequests {...data} copy={view.personal.copy} on={props.on} isLoading={isLoading} />
                )}
            />
        </Stack>
    )
}
const ModulePanel = (props: ShiftsWorkbenchBaseProps) => {
    const view = props.props
    switch (props.shape) {
        case "week":
            return (
                <SlotView
                    {...view.week}
                    placeholder={WEEK_EMPTY}
                    onRetry={props.on.retryWeek}
                    render={(data, isLoading) => (
                        <ShiftsWeek {...data} copy={view.week.copy} on={props.on} isLoading={isLoading} />
                    )}
                />
            )
        case "setup":
            return (
                <SlotView
                    {...view.setup}
                    placeholder={SETUP_EMPTY}
                    onRetry={props.on.retryBench}
                    render={(data, isLoading) => (
                        <ShiftsSetup {...data} copy={view.setup.copy} on={props.on} isLoading={isLoading} />
                    )}
                />
            )
        case "requests":
            return (
                <SlotView
                    {...view.requests}
                    placeholder={REQUESTS_EMPTY}
                    onRetry={props.on.retryBench}
                    render={(data, isLoading) =>
                        data.isVisible && data.requests !== undefined ? (
                            <ShiftsRequests
                                {...view.requests.copy.requests}
                                {...data.requests}
                                on={props.on.requests}
                                isLoading={isLoading}
                            />
                        ) : null
                    }
                />
            )
        case "quick":
            return (
                <SlotView
                    {...view.quick}
                    placeholder={QUICK_EMPTY}
                    onRetry={props.on.retryBench}
                    render={(data, isLoading) =>
                        data.isVisible ? (
                            <ShiftsQuickImport
                                {...view.quick.copy.quickImport}
                                on={props.on.quickImport}
                                isLoading={isLoading}
                            />
                        ) : null
                    }
                />
            )
        case "mine":
            return <MinePanel {...props} />
        case "explanation":
            return null
    }
}
const DashboardCards = (props: ShiftsPanelProps) => {
    const regions = props.props.regions
    return (
        <Grid kind="cards" columns={3}>
            <SlotView
                {...regions.done}
                onRetry={props.on.retryDashboard}
                render={(done, isLoading) => (
                    <DoneRegion label={regions.done.label} view={done} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.connections}
                onRetry={props.on.retryDashboard}
                render={(connections, isLoading) => (
                    <ConnectionsRegion label={regions.connections.label} view={connections} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.knowledge}
                onRetry={props.on.retryDashboard}
                render={(knowledge, isLoading) => (
                    <KnowledgeRegion label={regions.knowledge.label} view={knowledge} isLoading={isLoading} />
                )}
            />
        </Grid>
    )
}

const Overview = (props: ShiftsWorkbenchBaseProps) => {
    const view = props.props
    return (
        <Stack gap="region">
            <SlotView
                {...view.regions.waiting}
                onRetry={props.on.retryDashboard}
                render={(waiting, isLoading) => (
                    <WaitingRegion label={view.regions.waiting.label} view={waiting} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...view.ribbon}
                placeholder={FIGURES_EMPTY}
                onRetry={props.on.retryRibbon}
                render={(figures, isLoading) =>
                    figures.isVisible ? (
                        <ShiftsFigures {...view.ribbon.copy} {...figures} isLoading={isLoading} />
                    ) : null
                }
            />
            <Tabs
                label={view.tabsLabel}
                selectedKey={view.selectedTab}
                inset="none"
                labelVisibility="always"
                items={view.tabs}
                panelId={panelId}
                onSelect={props.on.selectTab}
            />
            <div role="tabpanel" id={panelId(view.selectedTab)}>
                <ModulePanel {...props} />
            </div>
            <DashboardCards {...props} />
        </Stack>
    )
}

const Explanation = (props: ShiftsPanelProps) => {
    const view = props.props
    return (
        <WorkbenchWhyFrame {...view.why} label={view.why.paneLabel} onClose={props.on.closeWhy}>
            <SlotView
                {...view.regions.waiting}
                onRetry={props.on.retryDashboard}
                render={(waiting, isLoading) => (
                    <WorkbenchPaneRows
                        label={view.regions.waiting.label}
                        rows={waiting.rows}
                        openLabel={waiting.openLabel}
                        isLoading={isLoading}
                    />
                )}
            />
            <SlotView
                {...view.regions.done}
                onRetry={props.on.retryDashboard}
                render={(done, isLoading) => (
                    <WorkbenchPaneRows
                        label={view.regions.done.label}
                        rows={done.rows}
                        openLabel={null}
                        isLoading={isLoading}
                    />
                )}
            />
        </WorkbenchWhyFrame>
    )
}

/** Draws the existing workbench arrangements with independent real read failures and retries. */
export const ShiftsWorkbenchBase = (props: ShiftsWorkbenchBaseProps) => {
    switch (props.shape) {
        case "week":
        case "requests":
        case "setup":
        case "quick":
        case "mine":
            return <Overview {...props} />
        case "explanation":
            return <Explanation {...props} />
    }
}
