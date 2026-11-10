import { Badge, Button, Cluster, Section, Text, type BadgeTone, type ListRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { WorkspaceRowSheet } from "@/components/composites/WorkspaceRowSheet"
import type {
    DataSlot,
    SlotLabels,
    WorkspaceMenuCommand,
    WorkspaceTableRowView,
    WorkspaceTableStatus,
    WorkspacesStackCopy,
    WorkspacesTableData,
} from "@/modules/types"

/** The callbacks of the stack: each takes the id of the workspace the row stands for. */
interface WorkspacesStackActions {
    readonly open: (id: string) => void
    readonly pay: (id: string) => void
    readonly showReason: (id: string) => void
    /** Restores a workspace its owner deleted. */
    readonly restore: (id: string) => void
    readonly retry: () => void
    /** A command of a row's sheet. */
    readonly command: (id: string, command: WorkspaceMenuCommand) => void
    /** Opens a row's sheet, or closes the open one with none. */
    readonly sheet: (id: string | undefined) => void
}

/** The workspaces as a slot (the same view as the table), its same-shape placeholder, and the words of the stack. */
export interface WorkspacesStackBaseProps {
    readonly props: {
        readonly slot: DataSlot<WorkspacesTableData>
        readonly placeholder: WorkspacesTableData
        readonly labels: SlotLabels
        readonly copy: WorkspacesStackCopy
        /** The row whose sheet is open; none when every sheet is closed. */
        readonly sheetId: string | undefined
    }
    readonly on: WorkspacesStackActions
}

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

/** The lower line of a row: the status and when it was last opened on the start side, the one action at the end. */
const rowDetail = (props: WorkspacesStackBaseProps, row: WorkspaceTableRowView) => {
    const { copy } = props.props
    const action = ACTION_OF_STATUS[row.status]
    return (
        <Cluster gap="inline" align="center" justify="between">
            <Cluster gap="inline" align="center">
                <Badge tone={STATUS_TONES[row.status]} isDot>
                    {copy.statuses[row.status]}
                </Badge>
                <Text size="sm" tone="muted">
                    {row.lastOpened}
                </Text>
            </Cluster>
            <Button
                intent={row.isPrimary ? "commit" : "neutral"}
                {...(action === "open" ? { endArrow: true } : {})}
                isPending={row.isBusy}
                onPress={() => props.on[action](row.id)}
            >
                {copy.actions[action]}
            </Button>
        </Cluster>
    )
}

/** The ⋯ control of a row: its bottom sheet with the row's identity and commands. */
const sheetOf = (props: WorkspacesStackBaseProps, row: WorkspaceTableRowView) => (
    <WorkspaceRowSheet
        props={{
            id: row.id,
            isOpen: props.props.sheetId === row.id,
            name: row.name,
            meta: row.identity,
            closeLabel: props.props.copy.sheetClose,
            menu: row.menu,
        }}
        on={{
            command: (command) => props.on.command(row.id, command),
            openChange: (isOpen) => props.on.sheet(isOpen ? row.id : undefined),
        }}
    />
)

/** One row: avatar, name, meta and the menu on top, the detail line below. */
const rowOf = (props: WorkspacesStackBaseProps, row: WorkspaceTableRowView): ListRowData => ({
    id: row.id,
    title: row.name,
    description: row.meta,
    leading: { avatar: { name: row.name, seed: row.id, shape: "rounded" } },
    actionPlacement: "end",
    control: sheetOf(props, row),
    detail: rowDetail(props, row),
})

/** Draws the workspaces of the person as stacked rows for a narrow screen, under the same heading and count as the table. */
export const WorkspacesStackBase = (props: WorkspacesStackBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.labels}
        errorLayout="band"
        onRetry={props.on.retry}
        render={(data, isLoading) => (
            <Section
                kind="list"
                title={props.props.copy.title}
                fact={String(data.rows.length)}
                items={data.rows.map((row) => rowOf(props, row))}
                empty={null}
                isLoading={isLoading}
            />
        )}
    />
)
