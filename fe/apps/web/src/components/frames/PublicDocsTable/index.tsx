import { Badge, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import type { HeaderZone, TableRowData } from "@starci/grammar/common"
import type { PublicBrainCopy, PublicTableRowView, PublicTableView } from "@/modules/types"

/** What the table of public documents draws and calls. */
interface PublicDocsTableProps {
    readonly table: PublicTableView
    readonly copy: PublicBrainCopy
    /** The owner may start a document: the empty table offers the first one. */
    readonly onCompose: (() => void) | undefined
    readonly onSearch: (value: string) => void
    readonly onTab: (id: string) => void
    readonly onClear: () => void
}

/** One row: the title with its line, the kind, the status and who approved it and when. Pressing it opens the document in the drawer. */
const rowOf = (row: PublicTableRowView): TableRowData => ({
    id: row.id,
    href: row.href,
    cells: {
        title: (
            <>
                <Text isStrong>{row.title}</Text>
                <Text size="sm" tone="muted">
                    {row.line}
                </Text>
            </>
        ),
        kind: <Text>{row.kind}</Text>,
        status: <Badge tone={row.badge.tone}>{row.badge.label}</Badge>,
        approval: <Text tone="muted">{row.approval}</Text>,
    },
})

/** What the notice of an empty table draws and calls. */
type EmptyProps = Pick<PublicDocsTableProps, "table" | "copy" | "onCompose" | "onClear">

/** The notice of a table with no rows: the library has none yet, or the filter and the search kept none. */
const EmptyOf = (props: EmptyProps) => {
    const { table, copy } = props
    if (table.query === "" && table.tab === "all") {
        return (
            <EmptyNotice
                message={table.card.emptyTitle}
                description={copy.emptyBody}
                {...(props.onCompose === undefined
                    ? {}
                    : { actionLabel: copy.emptyAction, onAction: props.onCompose })}
            />
        )
    }
    return (
        <EmptyNotice
            message={copy.noMatchTitle}
            description={copy.noMatchBody}
            actionLabel={copy.clearFilters}
            actionIntent="neutral"
            onAction={props.onClear}
        />
    )
}

/** The words and commands of the zone over the rows. */
interface ToolbarInput {
    readonly table: PublicTableView
    readonly copy: PublicBrainCopy
    readonly onTab: (id: string) => void
    readonly onSearch: (value: string) => void
}

/** The two zones over the rows: the filter tabs with their counts, then the search at full width under them. */
const zonesOf = (input: ToolbarInput): readonly HeaderZone[] => [
    {
        kind: "filter",
        label: input.copy.tabsLabel,
        selectedKey: input.table.tab,
        moreLabel: input.copy.moreFilters,
        onSelect: input.onTab,
        items: input.table.tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            ...(tab.count === undefined ? {} : { count: tab.count }),
        })),
    },
    {
        kind: "search",
        label: input.copy.searchLabel,
        placeholder: input.copy.searchPlaceholder,
        clearLabel: input.copy.clearSearch,
        value: input.table.query,
        onChange: input.onSearch,
    },
]

/**
 * The public documents as one full-width table, so no title is cut: the filter tabs with their counts and the search over it, then a
 * row per document with its kind, status and who approved it. A row opens the document in a drawer.
 */
export const PublicDocsTable = (props: PublicDocsTableProps) => {
    const { table, copy } = props
    const { card } = table
    return (
        <SurfaceCard
            kind="table"
            label={copy.listTitle}
            headingLevel={2}
            {...(card.count === undefined ? {} : { fact: copy.tableCount(card.count) })}
            headers={zonesOf({ table, copy, onTab: props.onTab, onSearch: props.onSearch })}
            isLoading={card.isLoading}
            {...(card.error === undefined ? {} : { error: card.error })}
            columns={[
                { id: "title", label: copy.columnTitle },
                { id: "kind", label: copy.columnKind, priority: "low" },
                { id: "status", label: copy.columnStatus },
                { id: "approval", label: copy.columnApproval, priority: "low" },
            ]}
            rows={card.rows.map(rowOf)}
            empty={<EmptyOf table={table} copy={copy} onCompose={props.onCompose} onClear={props.onClear} />}
        />
    )
}
