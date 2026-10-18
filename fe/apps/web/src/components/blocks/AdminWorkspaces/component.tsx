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
import { AdminLoadState, type AdminLoad } from "@/components/composites/AdminLoadState"

/** One filter chip of the list. */
interface FilterView {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** Copy, filters and rows the workspaces page supplies. */
interface AdminWorkspacesViewProps {
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

/** Draws the workspace list: search, filter chips and one table row per customer business. */
const AdminWorkspacesView = (props: AdminWorkspacesViewProps) => {
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

    const renderCell = (row: AdminWorkspaceRowView, columnId: string) => renderWorkspaceCell(row, columnId, props)

    return (
        <>
            <SectionHeader
                level={1}
                eyebrow={props.props.eyebrow}
                title={props.props.title}
                description={props.props.description}
            />
            {renderWorkspaceFilters(props)}
            <Region labelledBy="admin-workspaces-shown" className={STACK_CLASS_NAME}>
                <SectionHeader id="admin-workspaces-shown" level={2} title={props.props.shownTitle} />
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

/** The workspace read and, once it arrived, the view it draws. */
export interface AdminWorkspacesBaseProps {
    readonly props: {
        readonly load: AdminLoad
        readonly view: AdminWorkspacesViewProps["props"] | undefined
    }
}

/** Draws the loading state, the failure or the finished view of the connected read. */
export const AdminWorkspacesBase = (props: AdminWorkspacesBaseProps) => (
    <AdminLoadState {...props.props.load}>
        {props.props.view === undefined ? null : <AdminWorkspacesView props={props.props.view} />}
    </AdminLoadState>
)

/** Draws the div section of the AdminWorkspaces view. */
const renderWorkspaceFilters = (props: AdminWorkspacesViewProps) => (
    <div className={FILTERS_CLASS_NAME}>
        <Form label={props.props.searchLabel} action={ADMIN_ROUTES.workspaces} method="get">
            <div className={SEARCH_FORM_CLASS_NAME}>
                <Input
                    id="admin-search"
                    name="q"
                    label={props.props.searchField}
                    placeholder={props.props.searchPlaceholder}
                    defaultValue={props.props.query}
                />
                <Button type="submit" variant="secondary">
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
                        href={filter.href}
                    >
                        {filter.label}
                    </TextAction>
                </ListItem>
            ))}
        </List>
    </div>
)

/** Draws a workspace table cell from its column identity. */
const renderWorkspaceCell = (row: AdminWorkspaceRowView, columnId: string, props: AdminWorkspacesViewProps) => {
    const none = (
        <Text size="sm" tone="muted">
            {props.props.noneLabel}
        </Text>
    )

    switch (columnId) {
        case "workspace":
            return (
                <div className={CELL_STACK_CLASS_NAME}>
                    <Button size="sm" variant="ghost" href={row.href}>
                        {row.name}
                    </Button>
                    {row.needsAttention ? <Badge tone="warning">{props.props.attentionLabel}</Badge> : null}
                </div>
            )
        case "owner":
            return <Text size="sm">{row.ownerEmail}</Text>
        case "billing":
            return (
                <div className={CELL_STACK_CLASS_NAME}>
                    <Badge tone={row.statusTone}>{row.status}</Badge>
                    {row.paidUntil === null ? null : (
                        <Text size="xs" tone="muted">
                            {row.paidUntil}
                        </Text>
                    )}
                </div>
            )
        case "plan":
            return <Text size="sm">{row.plan}</Text>
        case "created":
            return <Text size="sm">{row.created}</Text>
        case "members":
            return <Text size="sm">{row.members}</Text>
        case "modules":
            return row.modules.length === 0 ? (
                none
            ) : (
                <div className={BADGE_WRAP_CLASS_NAME}>
                    <AdminBadges badges={row.modules} />
                </div>
            )
        case "connections":
            return row.connections.length === 0 ? (
                none
            ) : (
                <div className={CELL_STACK_CLASS_NAME}>
                    <div className={BADGE_WRAP_CLASS_NAME}>
                        <AdminBadges badges={row.connections} />
                    </div>
                    <AdminBadges badges={row.connectionWarnings} />
                </div>
            )
        case "lastMessage":
            return <Text size="sm">{row.lastMessage}</Text>
        case "messages":
            return <Text size="sm">{row.messages7d}</Text>
        default:
            return row.openDecisions > 0 ? (
                <Badge tone="warning">{row.openDecisions}</Badge>
            ) : (
                <Text size="sm">{0}</Text>
            )
    }
}
