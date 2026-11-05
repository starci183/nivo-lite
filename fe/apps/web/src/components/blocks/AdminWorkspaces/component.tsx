import {
    Badge,
    DataTable,
    EmptyNotice,
    Link,
    Page,
    SearchField,
    Stack,
    Cluster,
    Tabs,
    Text,
    type DataTableColumn,
} from "@starci/grammar/common"

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

/** The search and the filters above the table: the search keeps the chosen filter, the filters keep the search. */
const Controls = (props: AdminWorkspacesDrawProps) => (
    <Cluster gap="section" align="center">
        <SearchField
            label={props.props.searchLabel}
            isLabelHidden
            placeholder={props.props.searchPlaceholder}
            defaultValue={props.props.query}
            onSubmit={props.on.search}
            onClear={() => props.on.search("")}
            isLoading={props.isLoading}
        />
        <Tabs
            kind="filter"
            label={props.props.filtersLabel}
            moreLabel={props.props.moreLabel}
            inset="none"
            selectedKey={props.props.filter}
            items={props.props.filters.map((filter) => ({ id: filter.id, label: filter.label, count: filter.count }))}
            onSelect={props.on.filter}
        />
    </Cluster>
)

/** The table of workspaces, or the empty notice with the way out when the filter and the search keep none. */
const Results = (props: AdminWorkspacesDrawProps) => {
    const { columns } = props.props
    const columnList: ReadonlyArray<DataTableColumn> = [
        { id: "workspace", label: columns.workspace, isRowHeader: true },
        { id: "owner", label: columns.owner, priority: "low" },
        { id: "billing", label: columns.billing },
        { id: "plan", label: columns.plan, priority: "low" },
        { id: "modules", label: columns.agents, priority: "low" },
        { id: "connections", label: columns.connections, priority: "low" },
        { id: "lastMessage", label: columns.lastMessage, priority: "low" },
        { id: "messages", label: columns.messages, align: "end", priority: "low" },
        { id: "waiting", label: columns.waiting, align: "end", priority: "low" },
    ]
    return (
        <Stack gap="row">
            <DataTable
                label={props.props.tableLabel}
                isLoading={props.isLoading}
                columns={columnList}
                rows={props.props.rows}
                renderCell={(row, columnId) => renderWorkspaceCell(row, columnId, props, props.isLoading)}
                emptyContent={
                    <EmptyNotice
                        message={props.props.emptyTitle}
                        description={props.props.emptyHint}
                        actionLabel={props.props.clearLabel}
                        onAction={props.on.clear}
                    />
                }
            />
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.props.footer}
            </Text>
        </Stack>
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
            header={{ title: props.props.title, description: words.description }}
        >
            <SlotView
                slot={props.props.slot}
                placeholder={props.props.placeholder}
                labels={props.props.labels}
                errorDescription={props.props.errorHint}
                errorLayout="band"
                onRetry={props.on.retry}
                render={(view, isLoading) => (
                    <Stack gap="section">
                        <Controls props={view} isLoading={isLoading} on={props.on} />
                        <Results props={view} isLoading={isLoading} on={props.on} />
                    </Stack>
                )}
            />
        </Page>
    )
}

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
                    <Link href={row.href}>{row.name}</Link>
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
