import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentWorkflowTable, type AgentWorkflowTableCopy } from "@/components/composites/AgentWorkflowTable"
import { PaneHead } from "@/components/composites/PaneHead"
import {
    AgentWorkflowCreateDrawer,
    type AgentWorkflowCreateDrawerCopy,
} from "@/components/frames/AgentWorkflowCreateDrawer"
import type {
    DataSlot,
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
    }
    readonly on: {
        readonly retry: () => void
        readonly createOpen: () => void
        readonly createClose: () => void
        readonly createPick: (id: string) => void
        readonly createSubmit: () => void
    }
}

/** The Workflows tab: the head with the one primary command, the table of workflows and the drawer that makes one from a template. */
export const AgentWorkflowsHomeBase = (props: AgentWorkflowsHomeBaseProps) => {
    const { copy, grid, slotLabels } = props.props
    return (
        <>
            <PaneGrid label={copy.paneLabel} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                <Pane area="main" scroll content="full" label={copy.paneLabel}>
                    <PaneHead title={copy.title} primary={{ label: copy.create, onPress: props.on.createOpen }} />
                    <PaneSection gap="section">
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
