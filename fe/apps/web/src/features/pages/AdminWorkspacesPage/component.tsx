import {
    Badge,
    Button,
    DataTable,
    EmptyNotice,
    Form,
    Input,
    Region,
    SectionHeader,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { DataTableColumn } from "@starci/grammar/common"
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

/** One filter chip of the list. */
interface FilterView {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** Copy, filters and rows the workspaces page supplies. */
export interface AdminWorkspacesPageBaseProps {
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
export const AdminWorkspacesPageBase = (props: AdminWorkspacesPageBaseProps) => {
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
    const none = (
        <Text size="sm" tone="muted">
            {props.props.noneLabel}
        </Text>
    )
    const renderCell = (row: AdminWorkspaceRowView, columnId: string) => {
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

    return (
        <>
            <SectionHeader
                level={1}
                eyebrow={props.props.eyebrow}
                title={props.props.title}
                description={props.props.description}
            />
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
                <div className={CHIPS_CLASS_NAME} role="group" aria-label={props.props.filtersLabel}>
                    {props.props.filters.map((filter) => (
                        <TextAction
                            key={filter.id}
                            appearance="choice"
                            size="sm"
                            isCurrent={props.props.filter === filter.id}
                            href={filter.href}
                        >
                            {filter.label}
                        </TextAction>
                    ))}
                </div>
            </div>
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
