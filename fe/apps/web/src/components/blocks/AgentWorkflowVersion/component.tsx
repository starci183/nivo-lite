import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import {
    AgentWorkflowVersionCards,
    type AgentWorkflowVersionCardsCopy,
} from "@/components/composites/AgentWorkflowVersionCards"
import { PaneHead } from "@/components/composites/PaneHead"
import type { DataSlot, PaneGridLayout, SlotLabels, WorkflowDiffReadView } from "@/modules/types"

/** What the page of a version draws and what it does. */
export interface AgentWorkflowVersionBaseProps {
    readonly props: {
        readonly paneLabel: string
        readonly cards: AgentWorkflowVersionCardsCopy
        readonly diff: DataSlot<WorkflowDiffReadView>
        readonly placeholder: WorkflowDiffReadView
        readonly grid: PaneGridLayout
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/**
 * The page of one version of a workflow: its head (the title "Version N against N-1" and the summary of the changes, or the first-version
 * words), then one white card per job on the well: the steps, the rights and tools, the map.
 */
export const AgentWorkflowVersionBase = (props: AgentWorkflowVersionBaseProps) => {
    const { paneLabel, grid } = props.props
    return (
        <PaneGrid label={paneLabel} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
            <Pane area="main" scroll content="full" label={paneLabel}>
                <SlotView
                    slot={props.props.diff}
                    placeholder={props.props.placeholder}
                    labels={props.props.slotLabels}
                    onRetry={props.on.retry}
                    render={(diff, isLoading) => (
                        <>
                            <PaneHead
                                title={diff.title}
                                headingLevel={1}
                                description={diff.view.first === "" ? diff.view.summary : diff.view.first}
                                isLoading={isLoading}
                            />
                            <PaneSection gap="section">
                                <AgentWorkflowVersionCards props={{ copy: props.props.cards, view: diff.view, isLoading }} />
                            </PaneSection>
                        </>
                    )}
                />
            </Pane>
        </PaneGrid>
    )
}
