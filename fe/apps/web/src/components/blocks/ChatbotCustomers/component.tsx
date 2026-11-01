import {
    Badge,
    DataTable,
    EmptyNotice,
    SearchField,
    Text,
    TagGroup,
    type DataTableColumn,
    type DataTableRow,
} from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One customer as a row of the table, already worded. */
interface CustomerRowView extends DataTableRow {
    readonly name: string
    readonly company: string
    readonly channel: string
    readonly stage: string
    readonly need: string
    readonly replying: string
}

/** The words of the tab. */
interface ChatbotCustomersWords {
    readonly label: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly filtersLabel: string
    readonly customer: string
    readonly channel: string
    readonly stage: string
    readonly need: string
    readonly replying: string
    readonly emptyMessage: string
    readonly emptyDescription: string
    readonly full: string
}

/** Props for {@link ChatbotCustomersBase}. */
export interface ChatbotCustomersBaseProps {
    readonly props: {
        readonly words: ChatbotCustomersWords
        readonly slot: DataSlot<ReadonlyArray<CustomerRowView>>
        readonly slotLabels: SlotLabels
        readonly query: string
        readonly filter: string
        readonly chips: ReadonlyArray<{ readonly id: string; readonly label: string }>
        /** True when the list is as long as the overview carries, so older customers may be missing. */
        readonly isFull: boolean
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly filter: (id: string) => void
        readonly retry: () => void
    }
}

const PLACEHOLDER: ReadonlyArray<CustomerRowView> = [
    { id: "loading", href: "", name: "", company: "", channel: "", stage: "", need: "", replying: "" },
]

/** The content of one cell of the table. */
const customerCell = (row: CustomerRowView, columnId: string, isSkeleton: boolean) => {
    if (columnId === "customer") {
        return (
            <>
                <Text weight="medium" isSkeleton={isSkeleton}>
                    {row.name}
                </Text>
                {row.company === "" ? null : (
                    <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                        {row.company}
                    </Text>
                )}
            </>
        )
    }
    if (columnId === "stage") return <Badge isSkeleton={isSkeleton}>{row.stage}</Badge>
    if (columnId === "channel") return <Text isSkeleton={isSkeleton}>{row.channel}</Text>
    if (columnId === "need") return <Text isSkeleton={isSkeleton}>{row.need}</Text>
    return <Text isSkeleton={isSkeleton}>{row.replying}</Text>
}

/** Draws the Customers tab: a search, the chips and one table row per customer; a row opens its conversation in the inbox. */
export const ChatbotCustomersBase = (props: ChatbotCustomersBaseProps) => {
    const words = props.props.words
    const columns: ReadonlyArray<DataTableColumn> = [
        { id: "customer", label: words.customer, isRowHeader: true },
        { id: "channel", label: words.channel },
        { id: "stage", label: words.stage },
        { id: "need", label: words.need, priority: "low" },
        { id: "replying", label: words.replying },
    ]
    return (
        <SlotView
            slot={props.props.slot}
            placeholder={PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(rows, isSkeleton) => (
                <>
                    <SearchField
                        label={words.searchLabel}
                        isLabelHidden
                        placeholder={words.searchPlaceholder}
                        clearLabel={words.clearLabel}
                        value={props.props.query}
                        onValueChange={props.on.query}
                        isSkeleton={isSkeleton}
                    />
                    <TagGroup
                        label={words.filtersLabel}
                        selectionMode="single"
                        size="sm"
                        isSkeleton={isSkeleton}
                        items={props.props.chips}
                        selectedIds={[props.props.filter]}
                        onSelectionChange={(ids) => {
                            const picked = ids[0]
                            if (picked !== undefined) props.on.filter(picked)
                        }}
                    />
                    <>
                        <DataTable
                            label={words.label}
                            columns={columns}
                            rows={rows}
                            isLoading={isSkeleton}
                            renderCell={(row, columnId) => customerCell(row, columnId, isSkeleton)}
                            emptyContent={
                                <EmptyNotice message={words.emptyMessage} description={words.emptyDescription} />
                            }
                        />
                        {props.props.isFull ? (
                            <Text size="sm" tone="muted">
                                {words.full}
                            </Text>
                        ) : null}
                    </>
                </>
            )}
        </SlotView>
    )
}
