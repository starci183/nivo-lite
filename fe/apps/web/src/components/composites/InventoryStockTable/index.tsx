import type { InventoryStockData } from "@/modules/types"
import {
    Badge,
    ButtonGroup,
    Cluster,
    DataTable,
    DropdownMenu,
    EmptyNotice,
    IconButton,
    Stack,
    Text,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

type StockRowView = InventoryStockData["rows"][number]

/** What the stock table reads: the rows and column words, the commands of a row, and the read's loading flag. */
interface InventoryStockTableProps {
    readonly isLoading: boolean
    readonly label: string
    readonly columns: InventoryStockData["columns"]
    readonly rows: InventoryStockData["rows"]
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly adjustLabel: string
    readonly editLabel: string | null
    readonly isPending: boolean
    readonly on: {
        readonly quick: (id: string, sign: 1 | -1) => void
        readonly adjust: (id: string) => void
        readonly edit: (id: string) => void
    }
}

/** The quick plus and minus of a row, and its menu: adjust the level, and edit the item when the owner may. */
interface RowCommandsProps {
    readonly row: StockRowView
    readonly props: InventoryStockTableProps
}
const RowCommands = (input: RowCommandsProps) => {
    const { row, props } = input
    const { on } = props
    return (
        <Cluster gap="inline">
            <ButtonGroup
                isLoading={props.isLoading}
                label={row.stepLabel}
                actions={[
                    {
                        id: "less",
                        label: row.lessLabel,
                        intent: "neutral",
                        isDisabled: props.isPending,
                        onPress: () => on.quick(row.id, -1),
                    },
                    {
                        id: "more",
                        label: row.moreLabel,
                        intent: "neutral",
                        isDisabled: props.isPending,
                        onPress: () => on.quick(row.id, 1),
                    },
                ]}
            />
            <DropdownMenu
                placement="bottom end"
                entries={[
                    { id: "adjust", label: props.adjustLabel, onAction: () => on.adjust(row.id) },
                    ...(props.editLabel === null
                        ? []
                        : [{ id: "edit", label: props.editLabel, onAction: () => on.edit(row.id) }]),
                ]}
                trigger={<IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={row.name} />}
            />
        </Cluster>
    )
}

/** One cell of a stock row: the name over its identity, the levels, the state chips, and the row's commands. */
const cellOf = (row: StockRowView, columnId: string, props: InventoryStockTableProps) => {
    switch (columnId) {
        case "item":
            return (
                <Stack gap="identity">
                    <Text isStrong>{row.name}</Text>
                    <Text size="xs" tone="muted">
                        {row.identity}
                    </Text>
                </Stack>
            )
        case "onHand":
            return <Text isStrong>{row.total}</Text>
        case "minimum":
            return <Text tone="muted">{row.minimum}</Text>
        case "status":
            return (
                <Cluster gap="inline">
                    <Badge tone={row.statusTone} isDot>
                        {row.statusLabel}
                    </Badge>
                    {row.onOrderLabel === null ? null : <Badge tone="accent">{row.onOrderLabel}</Badge>}
                </Cluster>
            )
        case "cost":
            return <Text tone="muted">{row.cost}</Text>
        default:
            return <RowCommands row={row} props={props} />
    }
}

/** The stock table: one row per item with its level, minimum, state, unit cost and quick adjust. */
export const InventoryStockTable = (props: InventoryStockTableProps) => (
    <DataTable
        isLoading={props.isLoading}
        label={props.label}
        columns={[
            { id: "item", label: props.columns.item, isRowHeader: true },
            { id: "onHand", label: props.columns.onHand, align: "end" },
            { id: "minimum", label: props.columns.minimum, align: "end", priority: "low" },
            { id: "status", label: props.columns.status },
            { id: "cost", label: props.columns.cost, align: "end", priority: "low" },
            { id: "actions", label: props.adjustLabel, align: "end", priority: "low" },
        ]}
        rows={props.rows}
        emptyContent={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
        renderCell={(row, columnId) => cellOf(row, columnId, props)}
    />
)
