import { Badge, Button } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentRunsListTable } from "@/components/composites/AgentRunsListTable"
import { AgentWorkflowMap } from "@/components/composites/AgentWorkflowMap"
import { AgentWorkflowOverview, type AgentWorkflowOverviewCopy } from "@/components/composites/AgentWorkflowOverview"
import {
    AgentWorkflowVersionTable,
    type AgentWorkflowVersionTableCopy,
} from "@/components/composites/AgentWorkflowVersionTable"
import type { AgentWorkflowDiffCopy } from "@/components/composites/AgentWorkflowDiff"
import { PaneHead } from "@/components/composites/PaneHead"
import { AgentWorkflowDiffDrawer } from "@/components/frames/AgentWorkflowDiffDrawer"
import type {
    DataSlot,
    RunsFilter,
    RunsTableCopy,
    RunsView,
    SlotLabels,
    StepsMapView,
    WorkflowDetailView,
    WorkflowDiffReadView,
    WorkflowOverviewView,
} from "@/modules/types"

/** The tab of the page of a workflow that is open. */
export type DetailTab = "io" | "map" | "versions" | "runs"

/** The words of the parts of the page of a workflow. */
export interface AgentWorkflowDetailCopy {
    readonly paneLabel: string
    readonly editMap: string
    readonly addStep: string
    readonly mapTitle: string
    readonly graphLabel: string
    readonly graphCaption: string
    readonly graphEmpty: string
    readonly overview: AgentWorkflowOverviewCopy
    readonly versions: AgentWorkflowVersionTableCopy
    readonly diff: AgentWorkflowDiffCopy
    readonly close: string
    readonly runs: RunsTableCopy
}

/** What the head of the page needs: the workflow, the open tab and the way to the map. */
interface DetailHeadProps {
    readonly view: WorkflowDetailView
    readonly copy: AgentWorkflowDetailCopy
    readonly tab: DetailTab
    readonly isLoading: boolean
    readonly onMap: () => void
    readonly onAddStep: () => void
}

/** The head of the page: name, version and status, and the commands of the open part (the map has its two, the rest open the map). */
export const DetailHead = (props: DetailHeadProps) => {
    const { view, copy } = props
    return (
        <PaneHead
            title={view.head.name}
            headingLevel={1}
            description={view.head.facts}
            status={
                <Badge tone={view.head.statusTone} isDot>
                    {view.head.statusLabel}
                </Badge>
            }
            isLoading={props.isLoading}
            actions={
                props.tab === "map" ? (
                    <Button intent="neutral" size="sm" onPress={props.onAddStep}>
                        {copy.addStep}
                    </Button>
                ) : (
                    <Button intent="neutral" size="sm" onPress={props.onMap}>
                        {copy.editMap}
                    </Button>
                )
            }
        />
    )
}

/** What the open part draws. */
interface DetailPanelProps {
    readonly tab: DetailTab
    readonly copy: AgentWorkflowDetailCopy
    readonly view: WorkflowDetailView
    readonly overview: WorkflowOverviewView
    readonly map: StepsMapView
    readonly selectedStep: string | null
    readonly runs: DataSlot<RunsView>
    readonly runsPlaceholder: RunsView
    readonly runsFilter: RunsFilter
    readonly slotLabels: SlotLabels
    readonly isLoading: boolean
    readonly on: {
        readonly pressStep: (nodeKey: string) => void
        readonly rollback: (number: number) => void
        readonly diff: (number: number) => void
        readonly runsFilter: (next: Partial<RunsFilter>) => void
        readonly runsTab: (key: string) => void
        readonly runsRetry: () => void
    }
}

/** What the runs of this workflow need. */
interface RunsPanelProps {
    readonly copy: RunsTableCopy
    readonly slot: DataSlot<RunsView>
    readonly placeholder: RunsView
    readonly filter: RunsFilter
    readonly slotLabels: SlotLabels
    readonly on: {
        readonly filter: (next: Partial<RunsFilter>) => void
        readonly tab: (key: string) => void
        readonly retry: () => void
    }
}

/** The runs of this workflow only, read-only. */
const RunsPanel = (props: RunsPanelProps) => (
    <SlotView
        slot={props.slot}
        placeholder={props.placeholder}
        labels={props.slotLabels}
        onRetry={props.on.retry}
        render={(runs, isLoading) => (
            <AgentRunsListTable
                key={[props.filter.tab, props.filter.query, props.filter.source].join("|")}
                props={{ copy: props.copy, view: runs, filter: props.filter, workflows: null, isLoading }}
                on={{ filter: props.on.filter, tab: props.on.tab }}
            />
        )}
    />
)

/** The open part: the overview, the map, the versions or the runs. */
export const DetailPanel = (props: DetailPanelProps) => {
    const { copy, view, isLoading } = props
    if (props.tab === "io")
        return <AgentWorkflowOverview props={{ copy: copy.overview, view: props.overview, isLoading }} />
    if (props.tab === "versions")
        return (
            <AgentWorkflowVersionTable
                props={{ copy: copy.versions, versions: view.versions, isLoading }}
                on={{ rollback: props.on.rollback, diff: props.on.diff }}
            />
        )
    if (props.tab === "runs")
        return (
            <RunsPanel
                copy={copy.runs}
                slot={props.runs}
                placeholder={props.runsPlaceholder}
                filter={props.runsFilter}
                slotLabels={props.slotLabels}
                on={{ filter: props.on.runsFilter, tab: props.on.runsTab, retry: props.on.runsRetry }}
            />
        )
    return (
        <AgentWorkflowMap
            props={{
                title: copy.mapTitle,
                label: copy.graphLabel,
                caption: copy.graphCaption,
                emptyLabel: copy.graphEmpty,
                flow: props.map,
                selectedId: props.selectedStep,
                isLoading,
            }}
            on={{ pressStep: props.on.pressStep }}
        />
    )
}

/** What the diff drawer of a version needs. */
interface DiffPartProps {
    readonly copy: AgentWorkflowDetailCopy
    readonly slot: DataSlot<WorkflowDiffReadView>
    readonly placeholder: WorkflowDiffReadView
    readonly isOpen: boolean
    readonly slotLabels: SlotLabels
    readonly on: { readonly close: () => void; readonly retry: () => void }
}

/** The drawer that shows what a version changed against the one before it. */
export const DiffPart = (props: DiffPartProps) => (
    <SlotView
        slot={props.slot}
        placeholder={props.placeholder}
        labels={props.slotLabels}
        onRetry={props.on.retry}
        render={(diff, isLoading) => (
            <AgentWorkflowDiffDrawer
                props={{ copy: props.copy.diff, closeLabel: props.copy.close, diff, isOpen: props.isOpen, isLoading }}
                on={{ close: props.on.close }}
            />
        )}
    />
)
