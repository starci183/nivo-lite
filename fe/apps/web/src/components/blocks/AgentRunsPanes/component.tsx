import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentRunsListTable } from "@/components/composites/AgentRunsListTable"
import type { DataSlot, PaneGridLayout, RunsFilter, RunsView, SlotLabels, RunsTableCopy } from "@/modules/types"

/** The words of the runs page that do not come from the data. */
export interface AgentRunsPanesCopy {
    readonly paneLabel: string
    readonly table: RunsTableCopy
}

/** The runs page: the copy, the read, the filters and the arrangement of its panes. */
export interface AgentRunsPanesBaseProps {
    readonly props: {
        readonly copy: AgentRunsPanesCopy
        readonly slot: DataSlot<RunsView>
        readonly placeholder: RunsView
        readonly slotLabels: SlotLabels
        readonly filter: RunsFilter
        readonly grid: PaneGridLayout
        /** The page of the table, from one. */
        readonly page: number
        /** A phone has the workflow as a select in the table's search row; wider screens narrow by what triggered the run. */
        readonly isPhone: boolean
    }
    readonly on: {
        readonly filter: (next: Partial<RunsFilter>) => void
        readonly tab: (key: string) => void
        readonly page: (page: number) => void
        readonly retry: () => void
    }
}

/**
 * The runs of an agent as a workspace page: the table of runs alone in the main pane on the page ground (the workflow is a select in
 * its search row). Choosing a status, a workflow or a source narrows the table. A pane that reads the runs goes through the one recipe
 * of a slot's status.
 */
export const AgentRunsPanesBase = (props: AgentRunsPanesBaseProps) => {
    const { copy, filter, grid, page, isPhone } = props.props
    return (
        <PaneGrid label={copy.paneLabel} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
            <Pane area="main" scroll content="cards" label={copy.paneLabel}>
                <PaneSection>
                    <SlotView
                        slot={props.props.slot}
                        placeholder={props.props.placeholder}
                        labels={props.props.slotLabels}
                        onRetry={props.on.retry}
                        render={(view, isLoading) => (
                            <AgentRunsListTable
                                props={{ copy: copy.table, view, filter, workflows: isPhone ? view.workflows : null, isLoading, page }}
                                on={{ filter: props.on.filter, tab: props.on.tab, page: props.on.page }}
                            />
                        )}
                    />
                </PaneSection>
            </Pane>
        </PaneGrid>
    )
}
