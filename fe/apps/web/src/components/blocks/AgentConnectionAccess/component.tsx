import { Alert, Button, Stack, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionGrantRows } from "@/components/composites/ConnectionGrantRows"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One connection of the workspace and the level this agent has through it, "none" when it is not attached. */
export interface AgentConnectionAccessRow {
    readonly id: string
    readonly label: string
    readonly statusLabel: string
    readonly statusTone: "success" | "danger" | "warning" | "neutral"
    /** What this agent does through the connection; empty when it is only a data source. */
    readonly purposeLabel: string
    /** The access level of this agent, "none" when it is not attached. */
    readonly access: string
    /** The connection is disconnected: only the lowest level can stay. */
    readonly isDisconnected: boolean
}

/** Copy and state of the connections section of an agent. */
export interface AgentConnectionAccessBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly slot: DataSlot<ReadonlyArray<AgentConnectionAccessRow>>
        readonly placeholder: ReadonlyArray<AgentConnectionAccessRow>
        readonly slotLabels: SlotLabels
        readonly manageLabel: string
        readonly manageHref: string
        readonly ownerOnlyText: string
        /** The levels a pair can have, lowest first; the last one ("none") removes the pair. */
        readonly levels: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly levelLabel: string
        /** The label of the one control that attaches a connection not yet attached. */
        readonly attachLabel: string
        readonly noneAttached: string
        readonly canEdit: boolean
        readonly isDisabled: boolean
        /** Why the agent cannot reach anyone yet; empty when nothing is missing. */
        readonly notice: string
    }
    readonly on: {
        readonly pick: (connectionId: string, level: string) => void
        readonly attach: (connectionId: string) => void
    }
}

/** The pairs of this agent: the connections it is attached to, as the shared grant rows with the one control that attaches another. */
interface GrantRowsProps extends AgentConnectionAccessBaseProps {
    readonly rows: ReadonlyArray<AgentConnectionAccessRow>
    readonly isLoading: boolean
}

const GrantRows = (props: GrantRowsProps) => {
    const view = props.props
    return (
        <ConnectionGrantRows
            title={view.title}
            levels={view.levels}
            canManage={view.canEdit && !view.isDisabled}
            emptyMessage={view.noneAttached}
            isLoading={props.isLoading}
            assign={{
                label: view.attachLabel,
                options: props.rows
                    .filter((row) => row.access === "none")
                    .map((row) => ({ id: row.id, label: row.label })),
                onAssign: props.on.attach,
            }}
            rows={props.rows
                .filter((row) => row.access !== "none")
                .map((row) => ({
                    id: row.id,
                    title: row.label,
                    description: [row.statusLabel, row.purposeLabel].filter((part) => part !== "").join(" \u00b7 "),
                    leading: { avatar: { name: row.label, shape: "square" as const } },
                    levelLabel: view.levelLabel,
                    level: row.access,
                }))}
            onPick={props.on.pick}
        />
    )
}

/** Draws the connections an agent uses: its hint, the shared grant rows (level per connection, attach another), what is missing and the way to manage them all. */
export const AgentConnectionAccessBase = (props: AgentConnectionAccessBaseProps) => {
    const view = props.props
    return (
        <Stack gap="row">
            <Text size="sm" tone="muted">
                {view.hint}
            </Text>
            <SlotView
                slot={view.slot}
                placeholder={view.placeholder}
                labels={view.slotLabels}
                render={(rows, isLoading) => <GrantRows {...props} rows={rows} isLoading={isLoading} />}
            />
            {view.notice === "" ? null : <Alert tone="informative" title={view.notice} />}
            <Button intent="neutral" size="sm" href={view.manageHref}>
                {view.manageLabel}
            </Button>
            {view.canEdit ? null : (
                <Text size="xs" tone="muted">
                    {view.ownerOnlyText}
                </Text>
            )}
        </Stack>
    )
}
