import { EmptyNotice, FlowGraph, Stack, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkflowDiffView, WorkflowMark } from "@/modules/types"

/** The words of the cards of a version. */
export interface AgentWorkflowVersionCardsCopy {
    readonly stepsTitle: string
    readonly grantsTitle: string
    readonly mapTitle: string
    readonly mapLabel: string
    readonly mapCaption: string
    readonly nothing: string
}

/** What the cards of a version draw. */
interface AgentWorkflowVersionCardsProps {
    readonly props: {
        readonly copy: AgentWorkflowVersionCardsCopy
        readonly view: WorkflowDiffView
        readonly isLoading: boolean
    }
}

/** A changed row's settings before and after, one line each. */
type RowChange = { readonly from: string; readonly to: string }

/**
 * THE one place a diff row takes its mark: the Grammar diff row (gutter mark, tone, strikethrough for a removed row), the word a screen
 * reader reads for the mark, and the settings before and after of a changed row.
 */
const diffRowFieldsOf = (
    mark: WorkflowMark,
    markLabel: string,
    change?: RowChange,
): Pick<ListRowData, "diff" | "diffLabel" | "change"> => ({
    diff: mark,
    diffLabel: markLabel,
    ...(mark === "changed" && change !== undefined ? { change } : {}),
})

/**
 * What the page of a version holds, one job per white card: the steps added, removed and changed, the rights, tools and actions gained or
 * lost, and the map with the changed steps painted and the others faded. A first version has no card of changes, only the plain map.
 */
export const AgentWorkflowVersionCards = (props: AgentWorkflowVersionCardsProps) => {
    const { copy, view, isLoading } = props.props
    const steps: ReadonlyArray<ListRowData> = view.steps.map((step) => ({
        id: step.key,
        title: step.title,
        description: step.description,
        ...diffRowFieldsOf(step.mark, step.markLabel, step.change),
    }))
    const grants: ReadonlyArray<ListRowData> = view.grants.map((grant) => ({
        id: grant.key,
        title: grant.title,
        description: grant.kindLabel,
        ...diffRowFieldsOf(grant.mark, grant.markLabel),
    }))
    const isFirst = view.first !== ""
    const hasChanges = steps.length > 0 || grants.length > 0
    const nothing = <EmptyNotice message={copy.nothing} iconSource={nivoIconSource("saved", "leading")} />
    return (
        <Stack gap="section">
            {steps.length === 0 ? null : (
                <SurfaceCard
                    kind="list"
                    label={copy.stepsTitle}
                    headingLevel={2}
                    items={steps}
                    isLoading={isLoading}
                    empty={nothing}
                />
            )}
            {grants.length === 0 ? null : (
                <SurfaceCard
                    kind="list"
                    label={copy.grantsTitle}
                    headingLevel={2}
                    items={grants}
                    isLoading={isLoading}
                    empty={nothing}
                />
            )}
            {isFirst || hasChanges ? null : (
                <SurfaceCard label={copy.stepsTitle} headingLevel={2} isLoading={isLoading}>
                    {nothing}
                </SurfaceCard>
            )}
            <SurfaceCard
                label={copy.mapTitle}
                headingLevel={2}
                isLoading={isLoading}
                {...(isFirst ? {} : { note: copy.mapCaption })}
            >
                <FlowGraph
                    label={copy.mapLabel}
                    nodes={view.flow.nodes}
                    edges={view.flow.edges}
                    layout="steps"
                    statusLabels={view.flow.statusLabels}
                    isInteractive={false}
                    isLoading={isLoading}
                    height="fill"
                />
            </SurfaceCard>
        </Stack>
    )
}
