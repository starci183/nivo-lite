import {
    AlertDialog,
    Badge,
    Cluster,
    DataTable,
    EmptyNotice,
    Icon,
    Link,
    Section,
    Text,
    TextAction,
    type DataTableColumn,
    type DataTableRow,
} from "@starci/grammar/common"
import { useState } from "react"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkflowVersionRowView } from "@/modules/types"

/** The words of the table of versions. */
export interface AgentWorkflowVersionTableCopy {
    readonly title: string
    readonly number: string
    readonly date: string
    readonly author: string
    readonly note: string
    readonly status: string
    readonly running: string
    readonly old: string
    readonly rollback: string
    readonly open: string
    readonly confirmTitle: (number: number) => string
    readonly confirmBody: (number: number) => string
    readonly confirm: string
    readonly cancel: string
    readonly empty: string
}

/** What a person does with a version: go back to it. Seeing what it changed is the link of its row. */
interface VersionActions {
    readonly rollback: (number: number) => void
}

/** What the table of versions draws and what it does. */
interface AgentWorkflowVersionTableProps {
    readonly props: {
        readonly copy: AgentWorkflowVersionTableCopy
        readonly versions: ReadonlyArray<WorkflowVersionRowView>
        /** The address of the page of one version. */
        readonly hrefOf: (number: number) => string
        readonly isLoading: boolean
    }
    readonly on: VersionActions
}

/** One row of the table: a version. */
interface VersionRow extends DataTableRow {
    readonly version: WorkflowVersionRowView
}

/** The state of one row and the ways to act on it. */
interface StateCellProps {
    readonly version: WorkflowVersionRowView
    readonly copy: AgentWorkflowVersionTableCopy
    readonly onAsk: (number: number) => void
}

/** "Running" on the current version, "Old" with the way back on the others. */
const StateCell = (props: StateCellProps) => (
    <Cluster gap="row" wrap={false}>
        {props.version.isActive ? (
            <Badge tone="success" isDot>
                {props.copy.running}
            </Badge>
        ) : (
            <>
                <Badge tone="neutral">{props.copy.old}</Badge>
                <TextAction onPress={() => props.onAsk(props.version.number)}>{props.copy.rollback}</TextAction>
            </>
        )}
    </Cluster>
)

/** The versions of a workflow, newest first, as one table under a Section head with the count; going back asks first. */
export const AgentWorkflowVersionTable = (props: AgentWorkflowVersionTableProps) => {
    const { copy, versions } = props.props
    const [asked, setAsked] = useState<number | null>(null)
    const columns: ReadonlyArray<DataTableColumn<VersionRow>> = [
        { id: "number", label: copy.number, width: "fit", isRowHeader: true },
        { id: "date", label: copy.date, width: "fit", hideBelow: "tablet" },
        { id: "author", label: copy.author, width: "fit", hideBelow: "tablet" },
        { id: "note", label: copy.note },
        { id: "status", label: copy.status, width: "fit" },
        { id: "open", label: copy.open, width: "fit", isLabelHidden: true },
    ]
    const rows: ReadonlyArray<VersionRow> = versions.map((version) => ({
        id: String(version.number),
        href: props.props.hrefOf(version.number),
        version,
    }))
    const renderCell = (row: VersionRow, columnId: string) => {
        if (columnId === "number")
            return (
                <Link variant="plain" href={props.props.hrefOf(row.version.number)}>
                    {row.version.title}
                </Link>
            )
        if (columnId === "date") return <Text tone="muted">{row.version.date ?? ""}</Text>
        if (columnId === "author") return <Text tone="muted">{row.version.author ?? ""}</Text>
        if (columnId === "note") return <Text tone="muted">{row.version.note ?? row.version.description}</Text>
        if (columnId === "open") return <Icon source={nivoIconSource("disclosure", "leading")} />
        return <StateCell version={row.version} copy={copy} onAsk={setAsked} />
    }
    return (
        <>
            <Section title={copy.title} headingLevel={2} count={versions.length} isLoading={props.props.isLoading}>
                <DataTable
                    label={copy.title}
                    columns={columns}
                    rows={rows}
                    renderCell={renderCell}
                    isLoading={props.props.isLoading}
                    emptyContent={<EmptyNotice message={copy.empty} iconSource={nivoIconSource("saved", "leading")} />}
                />
            </Section>
            {asked === null ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={() => setAsked(null)}
                    title={copy.confirmTitle(asked)}
                    description={copy.confirmBody(asked)}
                    tone="neutral"
                    confirmLabel={copy.confirm}
                    cancelLabel={copy.cancel}
                    onConfirm={() => props.on.rollback(asked)}
                    onCancel={() => setAsked(null)}
                />
            )}
        </>
    )
}
