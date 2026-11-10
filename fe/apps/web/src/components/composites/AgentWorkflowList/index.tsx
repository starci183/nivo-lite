import { Badge, Button, EmptyNotice, ListBox, PaneHeader, PaneSection, type ListBoxItem } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkflowRowView } from "@/modules/types"

/** The words of the left pane of workflows. */
export interface AgentWorkflowListCopy {
    readonly title: string
    readonly label: string
    readonly create: string
    readonly empty: string
    readonly emptyBody: string
}

/** What the list of workflows draws and what it does. */
interface AgentWorkflowListProps {
    readonly props: {
        readonly copy: AgentWorkflowListCopy
        readonly rows: ReadonlyArray<WorkflowRowView>
        readonly selectedId: string
        readonly isLoading: boolean
    }
    readonly on: {
        readonly select: (id: string) => void
        readonly create: () => void
    }
}

/** One workflow: its name, where it came from under it, its status as a mark and its version at the end of the line. */
const itemOf = (row: WorkflowRowView): ListBoxItem => ({
    id: row.id,
    label: row.name,
    description: row.provenance,
    meta: row.versionLabel,
    footer: (
        <Badge isDot tone={row.statusTone}>
            {row.statusLabel}
        </Badge>
    ),
})

/**
 * The white column of the workflows of the agent: the head with the name of the list, "Create from template" on top (a neutral button),
 * then one row per workflow, the chosen one a fill.
 */
export const AgentWorkflowList = (props: AgentWorkflowListProps) => {
    const { copy, rows, selectedId } = props.props
    return (
        <>
            <PaneSection align="center">
                <PaneHeader title={copy.title} isLoading={props.props.isLoading} />
            </PaneSection>
            <PaneSection gap="row" isLoading={props.props.isLoading}>
                <Button intent="neutral" width="fill" onPress={props.on.create}>
                    {copy.create}
                </Button>
                <ListBox
                    label={copy.label}
                    items={rows.map(itemOf)}
                    selectionMode="single"
                    selectedIds={[selectedId]}
                    selectionIndicator="none"
                    emptyContent={
                        <EmptyNotice
                            message={copy.empty}
                            description={copy.emptyBody}
                            iconSource={nivoIconSource("overview", "leading")}
                        />
                    }
                    onSelectionChange={(ids) => {
                        const [id] = ids
                        if (id !== undefined) props.on.select(id)
                    }}
                />
            </PaneSection>
        </>
    )
}
