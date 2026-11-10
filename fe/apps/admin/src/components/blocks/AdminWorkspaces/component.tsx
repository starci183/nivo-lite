import { Badge, Cluster, EmptyNotice, Page, Stack, SurfaceCard, Text, type TableRowData } from "@starci/grammar/common"

import { AdminBadges } from "@/components/leaves/AdminBadges"

import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { AdminWorkspaceRowView, DataSlot, SlotLabels } from "@/modules/types"

/** One filter of the list, with the number of workspaces it keeps. */
interface FilterView {
    readonly id: string
    readonly label: string
    readonly count: number
}

/** Copy, filters and rows the workspaces page supplies. */
export interface AdminWorkspacesViewProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly filtersLabel: string
        readonly moreLabel: (count: number) => string
        /** The line under the table: how many of the workspaces are shown and what a name opens. */
        readonly footer: string
        readonly tableLabel: string
        readonly emptyTitle: string
        readonly emptyHint: string
        readonly attentionLabel: string
        readonly noneLabel: string
        readonly columns: {
            readonly workspace: string
            readonly owner: string
            readonly billing: string
            readonly plan: string
            readonly agents: string
            readonly connections: string
            readonly lastMessage: string
            readonly messages: string
            readonly waiting: string
        }
        /** The search now applied. */
        readonly query: string
        /** The filter now applied. */
        readonly filter: string
        readonly filters: ReadonlyArray<FilterView>
        readonly rows: ReadonlyArray<AdminWorkspaceRowView>
    }
}

/** The commands of the list: search, choose a filter, and clear both. */
interface AdminWorkspacesActions {
    readonly search: (query: string) => void
    readonly filter: (id: string) => void
    readonly clear: () => void
    readonly retry: () => void
}

/** The workspaces page with the skeleton flag the slot hands down. */
type AdminWorkspacesDrawProps = AdminWorkspacesViewProps & {
    readonly isLoading: boolean
    readonly on: AdminWorkspacesActions
}

/** The cells of one row of the table: the row itself opens the workspace. */
const rowOf = (row: AdminWorkspaceRowView, props: AdminWorkspacesDrawProps): TableRowData => ({
    id: row.id,
    href: row.href,
    cells: Object.fromEntries(
        COLUMN_IDS.map((columnId) => [columnId, renderWorkspaceCell(row, columnId, props, props.isLoading)]),
    ),
})

/**
 * The workspaces as one table card: the filter tabs with their counts, the search under them, and the full-bleed table, with the line
 * of how many are shown at its foot; the empty notice offers the way out when the filter and the search keep none.
 */
const Results = (props: AdminWorkspacesDrawProps) => {
    const { columns } = props.props
    return (
        <SurfaceCard
            kind="table"
            ariaLabel={props.props.tableLabel}
            isLoading={props.isLoading}
            headers={[
                {
                    kind: "filter",
                    label: props.props.filtersLabel,
                    moreLabel: props.props.moreLabel,
                    items: props.props.filters.map((filter) => ({ id: filter.id, label: filter.label, count: filter.count })),
                    selectedKey: props.props.filter,
                    onSelect: props.on.filter,
                },
                {
                    kind: "search",
                    label: props.props.searchLabel,
                    placeholder: props.props.searchPlaceholder,
                    clearLabel: props.props.clearLabel,
                    value: props.props.query,
                    onChange: props.on.search,
                },
            ]}
            columns={[
                { id: "workspace", label: columns.workspace },
                { id: "owner", label: columns.owner, priority: "low" },
                { id: "billing", label: columns.billing },
                { id: "plan", label: columns.plan, priority: "low" },
                { id: "modules", label: columns.agents, priority: "low" },
                { id: "connections", label: columns.connections, priority: "low" },
                { id: "lastMessage", label: columns.lastMessage, priority: "low" },
                { id: "messages", label: columns.messages, align: "end", priority: "low" },
                { id: "waiting", label: columns.waiting, align: "end", priority: "low" },
            ]}
            rows={props.props.rows.map((row) => rowOf(row, props))}
            empty={
                <EmptyNotice
                    message={props.props.emptyTitle}
                    description={props.props.emptyHint}
                    actionLabel={props.props.clearLabel}
                    onAction={props.on.clear}
                />
            }
            footers={[
                {
                    kind: "custom",
                    children: (
                        <Text size="sm" tone="muted" isLoading={props.isLoading}>
                            {props.props.footer}
                        </Text>
                    ),
                },
            ]}
        />
    )
}

/** The workspace read as a slot, its same-shape placeholder, and the words of its states. */
export interface AdminWorkspacesBaseProps {
    readonly props: {
        readonly slot: DataSlot<AdminWorkspacesViewProps["props"]>
        readonly placeholder: AdminWorkspacesViewProps["props"]
        /** The page title with the real count once the read is in; the placeholder's while it waits or failed. */
        readonly title: string
        readonly labels: SlotLabels
        /** The line under the failure: what to do about it. */
        readonly errorHint: string
    }
    readonly on: AdminWorkspacesActions
}

/** Draws the workspaces page: its header band from the words, over the search, the filters and the list, or the same as a skeleton, the failure with its retry, or the empty notice. */
export const AdminWorkspacesBase = (props: AdminWorkspacesBaseProps) => {
    const words = props.props.placeholder
    return (
        <Page
            measure="full"
            isLoading={"isLoading" in props.props.slot}
            header={{ breadcrumbs: "root", title: props.props.title, description: words.description }}
        >
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                errorDescription={props.props.errorHint}
                errorLayout="band"
                onRetry={props.on.retry}
                render={(view, isLoading) => (
                    <Results props={view} isLoading={isLoading} on={props.on} />
                )}
            />
        </Page>
    )
}

/** The columns of the table, in order. */
const COLUMN_IDS = ["workspace", "owner", "billing", "plan", "modules", "connections", "lastMessage", "messages", "waiting"]

/** The columns that draw one plain value, by column identity. */
const TEXT_CELLS: Readonly<Record<string, (row: AdminWorkspaceRowView) => string | number>> = {
    owner: (row) => row.ownerEmail,
    plan: (row) => row.plan,
    lastMessage: (row) => row.lastMessage,
    messages: (row) => row.messages7d,
}

/** Draws a workspace table cell from its column identity. */
const renderWorkspaceCell = (
    row: AdminWorkspaceRowView,
    columnId: string,
    props: AdminWorkspacesViewProps,
    isLoading: boolean,
) => {
    const none = (
        <Text size="sm" tone="muted" isLoading={isLoading}>
            {props.props.noneLabel}
        </Text>
    )

    const text = TEXT_CELLS[columnId]
    if (text !== undefined) {
        return (
            <Text size="sm" isLoading={isLoading}>
                {text(row)}
            </Text>
        )
    }

    switch (columnId) {
        case "workspace":
            return (
                <Cluster gap="inline" align="center">
                    <Text isStrong isLoading={isLoading}>
                        {row.name}
                    </Text>
                    {row.needsAttention ? (
                        <Badge tone="warning" isLoading={isLoading}>
                            {props.props.attentionLabel}
                        </Badge>
                    ) : null}
                </Cluster>
            )
        case "billing":
            return (
                <Stack gap="identity" align="start">
                    <Badge tone={row.statusTone} isDot isLoading={isLoading}>
                        {row.status}
                    </Badge>
                    {row.paidUntil === null ? null : (
                        <Text size="xs" tone="muted" isLoading={isLoading}>
                            {row.paidUntil}
                        </Text>
                    )}
                </Stack>
            )
        case "modules":
            return row.modules.length === 0 ? (
                none
            ) : (
                <Cluster gap="identity">
                    <AdminBadges badges={row.modules} isLoading={isLoading} />
                </Cluster>
            )
        case "connections":
            return row.connections.length === 0 ? (
                none
            ) : (
                <Stack gap="identity" align="start">
                    <Cluster gap="identity">
                        <AdminBadges badges={row.connections} isLoading={isLoading} />
                    </Cluster>
                    <AdminBadges badges={row.connectionWarnings} isLoading={isLoading} />
                </Stack>
            )
        default:
            return row.openDecisions > 0 ? (
                <Badge tone="warning" isLoading={isLoading}>
                    {String(row.openDecisions)}
                </Badge>
            ) : (
                <Text size="sm" isLoading={isLoading}>
                    {0}
                </Text>
            )
    }
}
