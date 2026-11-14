import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentWorkflowTable, type AgentWorkflowTableCopy } from "@/components/composites/AgentWorkflowTable"
import { PaneHead } from "@/components/composites/PaneHead"
import { WorkflowReadinessCard, type WorkflowReadinessCardCopy } from "@/components/composites/WorkflowReadinessCard"
import {
    AgentWorkflowCreateDrawer,
    type AgentWorkflowCreateDrawerCopy,
} from "@/components/frames/AgentWorkflowCreateDrawer"
import { WorkflowPickDrawer, type WorkflowPickDrawerCopy, type WorkflowPickDrawerView } from "@/components/frames/WorkflowPickDrawer"
import type {
    DataSlot,
    ReadinessPickView,
    ReadinessRowView,
    PaneGridLayout,
    SlotLabels,
    WorkflowCreateView,
    WorkflowTableRowView,
    WorkflowTemplatesView,
} from "@/modules/types"

/** The words of the Workflows tab. */
export interface AgentWorkflowsHomeCopy {
    readonly paneLabel: string
    readonly title: string
    readonly create: string
    readonly table: AgentWorkflowTableCopy
    readonly drawer: AgentWorkflowCreateDrawerCopy
    readonly readiness: WorkflowReadinessCardCopy
    readonly pick: WorkflowPickDrawerCopy
}

/** What the tab draws: the rows, the maker of a workflow and what each does. */
export interface AgentWorkflowsHomeBaseProps {
    readonly props: {
        readonly copy: AgentWorkflowsHomeCopy
        readonly slot: DataSlot<ReadonlyArray<WorkflowTableRowView>>
        readonly placeholder: ReadonlyArray<WorkflowTableRowView>
        readonly grid: PaneGridLayout
        readonly slotLabels: SlotLabels
        readonly create: WorkflowCreateView
        readonly templates: DataSlot<WorkflowTemplatesView>
        /** Why the hidden workflows cannot run, one row per reason; empty while every workflow shows. */
        readonly readiness: ReadonlyArray<ReadinessRowView> | undefined
        readonly canPick: boolean
        readonly pick: WorkflowPickDrawerView
    }
    readonly on: {
        readonly retry: () => void
        readonly createOpen: () => void
        readonly createClose: () => void
        readonly createPick: (id: string) => void
        readonly createSubmit: () => void
        readonly openPick: (pick: ReadinessPickView) => void
    }
}

/** The Workflows tab: the head with the one primary command, the table of workflows and the drawer that makes one from a template. */
export const AgentWorkflowsHomeBase = (props: AgentWorkflowsHomeBaseProps) => {
    const { copy, grid, slotLabels } = props.props
    return (
        <>
            <PaneGrid label={copy.paneLabel} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                <Pane area="main" scroll content="full" label={copy.paneLabel}>
                    <PaneHead title={copy.title} primary={{ label: copy.create, onPress: props.on.createOpen }} primaryOnPhone="head" />
                    <PaneSection gap="section">
                        <WorkflowReadinessCard
                            props={{ copy: copy.readiness, rows: props.props.readiness, canPick: props.props.canPick }}
                            on={{ pick: props.on.openPick }}
                        />
                        <SlotView
                            slot={props.props.slot}
                            placeholder={props.props.placeholder}
                            labels={slotLabels}
                            onRetry={props.on.retry}
                            render={(rows, isLoading) => (
                                <AgentWorkflowTable props={{ copy: copy.table, rows, isLoading }} />
                            )}
                        />
                    </PaneSection>
                </Pane>
            </PaneGrid>
            <WorkflowPickDrawer props={{ copy: copy.pick, pick: props.props.pick }} />
            <SlotView
                slot={props.props.templates}
                placeholder={{ templates: [] }}
                labels={slotLabels}
                onRetry={props.on.retry}
                render={(offer, isLoading) => (
                    <AgentWorkflowCreateDrawer
                        props={{ copy: copy.drawer, create: props.props.create, templates: offer.templates, isLoading }}
                        on={{ close: props.on.createClose, pick: props.on.createPick, submit: props.on.createSubmit }}
                    />
                )}
            />
        </>
    )
}
