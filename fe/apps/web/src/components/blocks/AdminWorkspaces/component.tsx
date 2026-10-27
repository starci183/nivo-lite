import {
    Badge,
    Button,
    DataTable,
    EmptyNotice,
    Form,
    Input,
    List,
    ListItem,
    Region,
    SectionHeader,
    Text,
    TextAction,
    type DataTableColumn,
} from "@starci/grammar/common"

import { AdminBadges } from "@/components/leaves/AdminBadges"
import type { AdminWorkspaceRowView } from "@/hooks/admin"
import { ADMIN_ROUTES } from "@/modules/routes"
import {
    BADGE_WRAP_CLASS_NAME,
    CELL_STACK_CLASS_NAME,
    CHIPS_CLASS_NAME,
    FILTERS_CLASS_NAME,
    SEARCH_FORM_CLASS_NAME,
    STACK_CLASS_NAME,
} from "./classNames"
import { SlotBoundView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

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
type AdminWorkspacesDrawProps = AdminWorkspacesViewProps & { readonly isSkeleton: boolean }

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
        renderWorkspaceCell(row, columnId, props, props.isSkeleton)

    return (
        <>
            <SectionHeader
                level={1}
                eyebrow={props.props.eyebrow}
                title={props.props.title}
                description={props.props.description}
                isSkeleton={props.isSkeleton}
            />
            {renderWorkspaceFilters(props, props.isSkeleton)}
            <Region labelledBy="admin-workspaces-shown" className={STACK_CLASS_NAME}>
                <SectionHeader
                    id="admin-workspaces-shown"
                    level={2}
                    title={props.props.shownTitle}
                    isSkeleton={props.isSkeleton}
                />
                <DataTable
                    label={props.props.tableLabel}
                    columns={columnList}
                    rows={props.props.rows}
                    renderCell={renderCell}
                    emptyContent={<EmptyNotice message={props.props.emptyTitle} description={props.props.emptyHint} />}
                />
            </Region>
        </>
    )
}

/** The workspace read as a slot, its same-shape placeholder, and the words of its states. */
export interface AdminWorkspacesBaseProps {
    readonly props: {
        readonly slot: DataSlot<AdminWorkspacesViewProps["props"]>
        readonly placeholder: AdminWorkspacesViewProps["props"]
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** Draws the finished list, or the same list as a skeleton, the failure with its retry, or the empty notice. */
export const AdminWorkspacesBase = (props: AdminWorkspacesBaseProps) => (
    <SlotBoundView from={props.props} onRetry={props.on.retry}>
        {(view, isSkeleton) => <AdminWorkspacesView props={view} isSkeleton={isSkeleton} />}
    </SlotBoundView>
)

/** Draws the div section of the AdminWorkspaces view. */
const renderWorkspaceFilters = (props: AdminWorkspacesViewProps, isSkeleton: boolean) => (
    <div className={FILTERS_CLASS_NAME}>
        <Form label={props.props.searchLabel} action={ADMIN_ROUTES.workspaces} method="get">
            <div className={SEARCH_FORM_CLASS_NAME}>
                <Input
                    id="admin-search"
                    name="q"
                    label={props.props.searchField}
                    placeholder={props.props.searchPlaceholder}
                    defaultValue={props.props.query}
                    isSkeleton={isSkeleton}
                />
                <Button type="submit" intent="neutral" isSkeleton={isSkeleton}>
                    {props.props.searchSubmit}
                </Button>
            </div>
        </Form>
        <List className={CHIPS_CLASS_NAME} label={props.props.filtersLabel}>
            {props.props.filters.map((filter) => (
                <ListItem key={filter.id}>
                    <TextAction
                        appearance="choice"
                        size="sm"
                        isCurrent={props.props.filter === filter.id}
                        isSkeleton={isSkeleton}
                        href={filter.href}
                    >
                        {filter.label}
                    </TextAction>
                </ListItem>
            ))}
        </List>
    </div>
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
    isSkeleton: boolean,
) => {
    const none = (
        <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
            {props.props.noneLabel}
        </Text>
    )

    const text = TEXT_CELLS[columnId]
    if (text !== undefined) {
        return (
            <Text size="sm" isSkeleton={isSkeleton}>
                {text(row)}
            </Text>
        )
    }

    switch (columnId) {
        case "workspace":
            return (
                <div className={CELL_STACK_CLASS_NAME}>
                    <Button size="sm" intent="neutral" href={row.href} isSkeleton={isSkeleton}>
                        {row.name}
                    </Button>
                    {row.needsAttention ? (
                        <Badge tone="warning" isSkeleton={isSkeleton}>
                            {props.props.attentionLabel}
                        </Badge>
                    ) : null}
                </div>
            )
        case "billing":
            return (
                <div className={CELL_STACK_CLASS_NAME}>
                    <Badge tone={row.statusTone} isSkeleton={isSkeleton}>
                        {row.status}
                    </Badge>
                    {row.paidUntil === null ? null : (
                        <Text size="xs" tone="muted" isSkeleton={isSkeleton}>
                            {row.paidUntil}
                        </Text>
                    )}
                </div>
            )
        case "modules":
            return row.modules.length === 0 ? (
                none
            ) : (
                <div className={BADGE_WRAP_CLASS_NAME}>
                    <AdminBadges badges={row.modules} isSkeleton={isSkeleton} />
                </div>
            )
        case "connections":
            return row.connections.length === 0 ? (
                none
            ) : (
                <div className={CELL_STACK_CLASS_NAME}>
                    <div className={BADGE_WRAP_CLASS_NAME}>
                        <AdminBadges badges={row.connections} isSkeleton={isSkeleton} />
                    </div>
                    <AdminBadges badges={row.connectionWarnings} isSkeleton={isSkeleton} />
                </div>
            )
        default:
            return row.openDecisions > 0 ? (
                <Badge tone="warning" isSkeleton={isSkeleton}>
                    {row.openDecisions}
                </Badge>
            ) : (
                <Text size="sm" isSkeleton={isSkeleton}>
                    {0}
                </Text>
            )
    }
}
