import {
    Badge,
    Button,
    DataTable,
    EmptyNotice,
    Form,
    Input,
    Link,
    Page,
    Section,
    Text,
    type DataTableColumn,
    Stack,
    Cluster,
} from "@starci/grammar/common"

import { AdminBadges } from "@/components/leaves/AdminBadges"
import { ADMIN_ROUTES } from "@/modules/routes"

import { SlotView } from "@nivo/agent-sdk/workbench"
import type { AdminWorkspaceRowView, DataSlot, SlotLabels } from "@/modules/types"

/** One filter chip of the list. */
interface FilterView {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** Copy, filters and rows the workspaces page supplies. */
export interface AdminWorkspacesViewProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly searchLabel: string
        readonly searchField: string
        readonly searchPlaceholder: string
        readonly searchSubmit: string
        readonly filtersLabel: string
        readonly shownTitle: string
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
            readonly created: string
            readonly members: string
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

/** The workspaces page with the skeleton flag the slot hands down. */
type AdminWorkspacesDrawProps = AdminWorkspacesViewProps & { readonly isLoading: boolean }

/** Draws the workspace list: search, filter chips and one table row per customer business. */
const AdminWorkspacesView = (props: AdminWorkspacesDrawProps) => {
    const { columns } = props.props
    const columnList: ReadonlyArray<DataTableColumn> = [
        { id: "workspace", label: columns.workspace, isRowHeader: true },
        { id: "owner", label: columns.owner },
        { id: "billing", label: columns.billing },
        { id: "plan", label: columns.plan },
        { id: "created", label: columns.created },
        { id: "members", label: columns.members, align: "end" },
        { id: "modules", label: columns.agents },
        { id: "connections", label: columns.connections },
        { id: "lastMessage", label: columns.lastMessage },
        { id: "messages", label: columns.messages, align: "end" },
        { id: "waiting", label: columns.waiting, align: "end" },
    ]

    const renderCell = (row: AdminWorkspaceRowView, columnId: string) =>
        renderWorkspaceCell(row, columnId, props, props.isLoading)

    return (
        <Stack gap="section">
            {renderWorkspaceFilters(props, props.isLoading)}
            <Section title={props.props.shownTitle} headingLevel={2} isLoading={props.isLoading}>
                <DataTable
                    label={props.props.tableLabel}
                    columns={columnList}
                    rows={props.props.rows}
                    renderCell={renderCell}
                    emptyContent={<EmptyNotice message={props.props.emptyTitle} description={props.props.emptyHint} />}
                />
            </Section>
        </Stack>
    )
}

/** The workspace read as a slot, its same-shape placeholder, and the words of its states. */
export interface AdminWorkspacesBaseProps {
    readonly props: {
        readonly slot: DataSlot<AdminWorkspacesViewProps["props"]>
        readonly placeholder: AdminWorkspacesViewProps["props"]
        readonly labels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** Draws the workspaces page: its header band from the words, over the finished list, or the same list as a skeleton, the failure with its retry, or the empty notice. */
export const AdminWorkspacesBase = (props: AdminWorkspacesBaseProps) => {
    const words = props.props.placeholder
    return (
        <Page measure="full" header={{ meta: words.eyebrow, title: words.title, description: words.description }}>
            <SlotView
                {...props.props}
                onRetry={props.on.retry}
                render={(view, isLoading) => <AdminWorkspacesView props={view} isLoading={isLoading} />}
            />
        </Page>
    )
}

/** Draws the div section of the AdminWorkspaces view. */
const renderWorkspaceFilters = (props: AdminWorkspacesViewProps, isLoading: boolean) => (
    <Cluster gap="row" align="end">
        <Form label={props.props.searchLabel} action={ADMIN_ROUTES.workspaces} method="get">
            <Cluster gap="row" align="end">
                <Input
                    id="admin-search"
                    name="q"
                    label={props.props.searchField}
                    placeholder={props.props.searchPlaceholder}
                    defaultValue={props.props.query}
                    isLoading={isLoading}
                />
                <Button type="submit" intent="neutral" isLoading={isLoading}>
                    {props.props.searchSubmit}
                </Button>
            </Cluster>
        </Form>
        <div role="group" aria-label={props.props.filtersLabel}>
            <Cluster gap="inline">
                {props.props.filters.map((filter) => (
                    <Link
                        key={filter.id}
                        isCurrent={props.props.filter === filter.id}
                        visited="uniform"
                        href={filter.href}
                    >
                        {filter.label}
                    </Link>
                ))}
            </Cluster>
        </div>
    </Cluster>
)

/** The columns that draw one plain value, by column identity. */
const TEXT_CELLS: Readonly<Record<string, (row: AdminWorkspaceRowView) => string | number>> = {
    owner: (row) => row.ownerEmail,
    plan: (row) => row.plan,
    created: (row) => row.created,
    members: (row) => row.members,
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
                <Stack gap="identity" align="start">
                    <Button size="sm" intent="neutral" href={row.href} isLoading={isLoading}>
                        {row.name}
                    </Button>
                    {row.needsAttention ? (
                        <Badge tone="warning" isLoading={isLoading}>
                            {props.props.attentionLabel}
                        </Badge>
                    ) : null}
                </Stack>
            )
        case "billing":
            return (
                <Stack gap="identity" align="start">
                    <Badge tone={row.statusTone} isLoading={isLoading}>
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
