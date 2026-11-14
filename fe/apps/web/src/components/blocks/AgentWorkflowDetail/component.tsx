import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { WorkflowStepDrawer } from "@/components/composites/WorkflowStepDrawer"
import type {
    DataSlot,
    PaneGridLayout,
    RunsFilter,
    RunsView,
    SlotLabels,
    StepAction,
    StepDrawerView,
    StepsMapView,
    WorkflowDetailView,
    WorkflowOverviewView,
    WorkflowStatus,
} from "@/modules/types"
import { DetailHead, DetailPanel, TemplateNotice, type AgentWorkflowDetailCopy, type DetailTab } from "./parts"

/** The step a new step goes after: the selected one, else the last of the map. */
const afterKeyOf = (page: AgentWorkflowDetailBaseProps["props"]): string =>
    page.selectedStep ?? page.map.nodes.at(-1)?.id ?? ""

/** What the page of a workflow draws and what it does. */
export interface AgentWorkflowDetailBaseProps {
    readonly props: {
        readonly copy: AgentWorkflowDetailCopy
        readonly detail: DataSlot<WorkflowDetailView>
        readonly placeholder: WorkflowDetailView
        readonly overview: WorkflowOverviewView
        readonly map: StepsMapView
        readonly drawer: StepDrawerView
        readonly selectedStep: string | null
        readonly runs: DataSlot<RunsView>
        readonly runsPlaceholder: RunsView
        readonly runsFilter: RunsFilter
        /** The part of the page the route names. */
        readonly part: DetailTab
        /** The address of the versions of this workflow: a version is its number after it. */
        readonly versionBase: string
        readonly grid: PaneGridLayout
        readonly slotLabels: SlotLabels
        /** True while a write of this page (turn on, pause, update from the template) is on its way. */
        readonly isWriting: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly openMap: () => void
        readonly step: (action: StepAction) => void
        readonly rollback: (number: number) => void
        readonly toggle: (status: WorkflowStatus) => void
        readonly sync: () => void
        readonly runsFilter: (next: Partial<RunsFilter>) => void
        readonly runsTab: (key: string) => void
        readonly runsRetry: () => void
    }
}

/**
 * The page of one workflow: its head, then four parts in the band: "In and Out" (what starts it and what it ends with), the map (the
 * graph canvas, with its two commands in the head), the versions and the runs of this workflow only. The drawer of a step opens above; a version opens its own page.
 */
export const AgentWorkflowDetailBase = (props: AgentWorkflowDetailBaseProps) => {
    const { copy, grid } = props.props
    const tab = props.props.part
    return (
        <>
            <PaneGrid label={copy.paneLabel} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                <Pane area="main" scroll content="full" label={copy.paneLabel}>
                    <SlotView
                        slot={props.props.detail}
                        placeholder={props.props.placeholder}
                        labels={props.props.slotLabels}
                        onRetry={props.on.retry}
                        render={(view, isLoading) => (
                            <>
                                <DetailHead
                                    view={view}
                                    copy={copy}
                                    tab={tab}
                                    isLoading={isLoading}
                                    onMap={props.on.openMap}
                                    onAddStep={() => props.on.step({ kind: "add", afterKey: afterKeyOf(props.props) })}
                                    onToggle={props.on.toggle}
                                    isWriting={props.props.isWriting}
                                />
                                <PaneSection gap="section">
                                    {view.notice === null ? null : (
                                        <TemplateNotice
                                            notice={view.notice}
                                            copy={copy}
                                            onSync={props.on.sync}
                                            previewHref={`${props.props.versionBase}/preview/${view.notice.version}`}
                                        />
                                    )}
                                    <DetailPanel
                                        tab={tab}
                                        copy={copy}
                                        view={view}
                                        overview={props.props.overview}
                                        map={props.props.map}
                                        selectedStep={props.props.selectedStep}
                                        runs={props.props.runs}
                                        runsPlaceholder={props.props.runsPlaceholder}
                                        runsFilter={props.props.runsFilter}
                                        slotLabels={props.props.slotLabels}
                                        versionBase={props.props.versionBase}
                                        isLoading={isLoading}
                                        on={{
                                            pressStep: (nodeKey) => props.on.step({ kind: "open", nodeKey }),
                                            rollback: props.on.rollback,
                                            runsFilter: props.on.runsFilter,
                                            runsTab: props.on.runsTab,
                                            runsRetry: props.on.runsRetry,
                                        }}
                                    />
                                </PaneSection>
                            </>
                        )}
                    />
                </Pane>
            </PaneGrid>
            <WorkflowStepDrawer view={props.props.drawer} onAction={props.on.step} />
        </>
    )
}
