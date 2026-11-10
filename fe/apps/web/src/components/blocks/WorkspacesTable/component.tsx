import {
    Avatar,
    Badge,
    Button,
    Cluster,
    Stack,
    SurfaceCard,
    Text,
    type BadgeTone,
    type TableRowData,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { WorkspaceRowMenu } from "@/components/composites/WorkspaceRowMenu"
import type {
    DataSlot,
    SlotLabels,
    WorkspaceMenuCommand,
    WorkspaceTableRowView,
    WorkspaceTableStatus,
    WorkspacesTableCopy,
    WorkspacesTableData,
} from "@/modules/types"

/** The callbacks of the table: each takes the id of the workspace the row stands for. */
interface WorkspacesTableActions {
    readonly open: (id: string) => void
    readonly pay: (id: string) => void
    readonly showReason: (id: string) => void
    /** Restores a workspace its owner deleted. */
    readonly restore: (id: string) => void
    readonly retry: () => void
    /** A command of a row's ⋯ menu. */
    readonly command: (id: string, command: WorkspaceMenuCommand) => void
}

/** The workspaces as a slot, its same-shape placeholder, and the words of the table. */
export interface WorkspacesTableBaseProps {
    readonly props: {
        readonly slot: DataSlot<WorkspacesTableData>
        readonly placeholder: WorkspacesTableData
        readonly labels: SlotLabels
        readonly copy: WorkspacesTableCopy
    }
    readonly on: WorkspacesTableActions
}

/** What a row draws: its data, the words, the callbacks and whether it is a skeleton. */
interface RowDrawProps {
    readonly row: WorkspaceTableRowView
    readonly copy: WorkspacesTableCopy
    readonly on: WorkspacesTableActions
    readonly isLoading: boolean
}

/** The columns of the table, in order. */
const COLUMN_IDS = ["workspace", "status", "lastOpened", "action", "menu"]

const STATUS_TONES: Readonly<Record<WorkspaceTableStatus, BadgeTone>> = {
    active: "success",
    pending: "warning",
    disabled: "muted",
    new: "accent",
    deleted: "danger",
}

/** Which command each status leads to: a freshly joined workspace opens like an active one. */
const ACTION_OF_STATUS = {
    active: "open",
    new: "open",
    pending: "pay",
    disabled: "showReason",
    deleted: "restore",
} as const

/** The avatar with the name over the meta line. */
const WorkspaceCell = (props: Pick<RowDrawProps, "row" | "isLoading">) => (
    <Cluster gap="row" align="center">
        <Avatar name={props.row.name} seed={props.row.id} shape="rounded" size="md" isLoading={props.isLoading} />
        <Stack gap="identity" align="start">
            <Text isLoading={props.isLoading}>{props.row.name}</Text>
            <Text size="xs" tone="muted" isLoading={props.isLoading}>
                {props.row.meta}
            </Text>
        </Stack>
    </Cluster>
)

/** The one button of the row: primary on the most recently opened workspace, plain on the others. */
const ActionCell = (props: RowDrawProps) => {
    const action = ACTION_OF_STATUS[props.row.status]
    return (
        <Button
            intent={props.row.isPrimary ? "commit" : "neutral"}
            {...(action === "open" ? { endArrow: true } : {})}
            isPending={props.row.isBusy}
            isLoading={props.isLoading}
            onPress={() => props.on[action](props.row.id)}
        >
            {props.copy.actions[action]}
        </Button>
    )
}

/** Draws one cell of a row from its column identity. */
const renderCell = (props: RowDrawProps, columnId: string) => {
    switch (columnId) {
        case "workspace":
            return <WorkspaceCell row={props.row} isLoading={props.isLoading} />
        case "status":
            return (
                <Badge tone={STATUS_TONES[props.row.status]} isDot isLoading={props.isLoading}>
                    {props.copy.statuses[props.row.status]}
                </Badge>
            )
        case "lastOpened":
            return (
                <Text size="sm" tone="muted" isLoading={props.isLoading}>
                    {props.row.lastOpened}
                </Text>
            )
        case "action":
            return <ActionCell {...props} />
        default:
            return (
                <WorkspaceRowMenu
                    props={props.row.menu}
                    on={{ command: (command) => props.on.command(props.row.id, command) }}
                />
            )
    }
}

/** The cells of one row of the table. */
const rowOf = (props: Omit<RowDrawProps, "row">, row: WorkspaceTableRowView): TableRowData => ({
    id: row.id,
    cells: Object.fromEntries(
        COLUMN_IDS.map((columnId) => [columnId, renderCell({ ...props, row }, columnId)]),
    ),
})

/** Draws the workspaces of the person as one table card titled with their count; a skeleton, failure or empty notice comes from the slot. */
export const WorkspacesTableBase = (props: WorkspacesTableBaseProps) => {
    const { copy } = props.props
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            errorLayout="band"
            onRetry={props.on.retry}
            render={(data, isLoading) => (
                <SurfaceCard
                    kind="table"
                    label={copy.title}
                    headingLevel={2}
                    fact={String(data.rows.length)}
                    isLoading={isLoading}
                    columns={[
                        { id: "workspace", label: copy.columns.workspace },
                        { id: "status", label: copy.columns.status },
                        { id: "lastOpened", label: copy.columns.lastOpened, priority: "low" },
                        { id: "action", label: copy.columns.action, align: "end" },
                        { id: "menu", label: copy.columns.more, align: "end" },
                    ]}
                    rows={data.rows.map((row) => rowOf({ copy, on: props.on, isLoading }, row))}
                    empty={null}
                />
            )}
        />
    )
}
