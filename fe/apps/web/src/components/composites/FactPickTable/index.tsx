import {
    Badge,
    Button,
    Checkbox,
    Cluster,
    EmptyNotice,
    IconButton,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import type { FooterZone, HeaderZone, TableRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { FactPickCopy, FactPickGroupView, FactPickRowView } from "@/modules/types"

/** Props for {@link FactPickTable}. */
interface FactPickTableProps {
    readonly props: {
        readonly copy: FactPickCopy
        /** The count or short fact beside the label. */
        readonly fact: string
        readonly groups: ReadonlyArray<FactPickGroupView>
        /** The zones above the table: the selection bar first, then the filters the page has. */
        readonly headers: ReadonlyArray<HeaderZone>
        readonly footers: ReadonlyArray<FooterZone>
        readonly canWrite: boolean
        readonly isLoading: boolean
    }
    readonly on: {
        readonly toggleRow: (key: string) => void
        readonly toggleGroup: (groupId: string) => void
        readonly toggleOpen: (groupId: string) => void
        readonly open: (factId: string) => void
        readonly compare: (key: string) => void
    }
}

/** What a cell of one fact reads: the table's props and the row. */
interface RowCellProps extends FactPickTableProps {
    readonly row: FactPickRowView
}

/** The first cell of a fact: a tick with its title and source when it waits, the plain words when nothing can be ticked. */
const ItemCell = (props: RowCellProps) => {
    const { row } = props
    if (row.isConflict || row.isSettled || !props.props.canWrite) {
        return (
            <Stack gap="identity">
                <Text isStrong>{row.title}</Text>
                <Text size="xs" tone="muted">
                    {row.source}
                </Text>
            </Stack>
        )
    }
    return (
        <Checkbox
            label={row.title}
            description={row.source}
            isSelected={row.isSelected}
            onSelectedChange={() => props.on.toggleRow(row.id)}
        />
    )
}

/** The last cell of a fact: the comparison of a conflict, the detail of every other fact. */
const ActionCell = (props: RowCellProps) =>
    props.row.isConflict ? (
        <Button intent="neutral" size="sm" onPress={() => props.on.compare(props.row.id)}>
            {props.props.copy.compareLabel}
        </Button>
    ) : (
        <IconButton
            intent="neutral"
            source={nivoIconSource("next", "leading")}
            label={props.props.copy.openLabel}
            onPress={() => props.on.open(props.row.factId)}
        />
    )

/** The heading row of a group: its tick, its words, its badges and the toggle that opens or folds its rows. */
const groupRowOf = (props: FactPickTableProps, group: FactPickGroupView): TableRowData => ({
    id: `group:${group.id}`,
    cells: {
        item:
            group.isSelectable && props.props.canWrite ? (
                <Checkbox
                    label={group.title}
                    description={group.line}
                    isSelected={group.selection === "all"}
                    isIndeterminate={group.selection === "some"}
                    onSelectedChange={() => props.on.toggleGroup(group.id)}
                />
            ) : (
                <Stack gap="identity">
                    <Text isStrong>{group.title}</Text>
                    <Text size="xs" tone="muted">
                        {group.line}
                    </Text>
                </Stack>
            ),
        value: (
            <Cluster gap="inline">
                {group.badges.map((badge) => (
                    <Badge key={badge.label} tone={badge.tone}>
                        {badge.label}
                    </Badge>
                ))}
            </Cluster>
        ),
        badge: null,
        action: (
            <Button intent="alternative" size="sm" onPress={() => props.on.toggleOpen(group.id)}>
                {group.toggleLabel}
            </Button>
        ),
    },
})

/** The row of one fact: its tick and words, its value, its trust or the choice it asks for, and what opens it. */
const factRowOf = (props: FactPickTableProps, row: FactPickRowView): TableRowData => ({
    id: row.id,
    cells: {
        item: <ItemCell {...props} row={row} />,
        value: <Text>{row.value}</Text>,
        badge: <Badge tone={row.badge.tone}>{row.badge.label}</Badge>,
        action: <ActionCell {...props} row={row} />,
    },
})

/**
 * A card of facts that can be ticked, as one table: each group (a document or a subject) is a heading row with its own tick and a toggle,
 * its facts under it when it is open. A fact that waits is ticked on its row; a conflict cannot be ticked and only opens the comparison.
 */
export const FactPickTable = (props: FactPickTableProps) => {
    const { copy, groups } = props.props
    const rows = groups.flatMap((group) => [
        groupRowOf(props, group),
        ...(group.isOpen ? group.rows.map((row) => factRowOf(props, row)) : []),
    ])
    return (
        <SurfaceCard
            kind="table"
            label={copy.label}
            count={Number(props.props.fact)}
            headers={props.props.headers}
            footers={props.props.footers}
            isLoading={props.props.isLoading}
            columns={[
                { id: "item", label: copy.columns.item },
                { id: "value", label: copy.columns.value },
                { id: "badge", label: copy.columns.badge, priority: "low", numeric: true },
                { id: "action", label: copy.columns.action, align: "end" },
            ]}
            rows={rows}
            empty={
                <EmptyNotice
                    message={copy.emptyTitle}
                    description={copy.emptyBody}
                    iconSource={nivoIconSource("brain", "leading")}
                />
            }
        />
    )
}
