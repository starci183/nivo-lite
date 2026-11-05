import { Cluster, DataTable, EmptyNotice, Text } from "@starci/grammar/common"
import type { DataTableRow } from "@starci/grammar/common"
import { Icon } from "@/components/leaves/Icon"
import type { AskSeesLane, AskSeesView, BrainAskCopy } from "@/modules/types"

/** What the comparison of what the audiences see draws. */
interface AskSeesTableProps {
    readonly sees: AskSeesView
    readonly copy: BrainAskCopy
    readonly isLoading: boolean
    readonly emptyLabel: string
}

/** One row of the table: a kind of knowledge. */
interface LaneRow extends DataTableRow {
    readonly lane: AskSeesLane
}

/**
 * What the customer and the chosen agent each read of every kind of knowledge: a tick (with how many items, where they are counted) or
 * a dash per cell. A comparison, so it is a table and not a list.
 */
export const AskSeesTable = (props: AskSeesTableProps) => {
    const { sees, copy } = props
    const rows: ReadonlyArray<LaneRow> = sees.lanes.map((lane) => ({ id: lane.id, lane }))
    const renderCell = (row: LaneRow, columnId: string) => {
        if (columnId === "lane") return <Text>{row.lane.label}</Text>
        const cell = row.lane.cells[columnId]
        if (!cell?.isOpen) return <Text tone="muted">–</Text>
        return (
            <Cluster gap="inline" wrap={false}>
                <Icon props={{ name: "copied", usage: "leading", ariaLabel: copy.seesOpen }} />
                {cell.count === null ? null : <Text>{String(cell.count)}</Text>}
            </Cluster>
        )
    }
    return (
        <DataTable
            label={copy.seesTable}
            columns={[
                { id: "lane", label: copy.seesLane, isRowHeader: true },
                ...sees.audiences.map((audience) => ({ id: audience.id, label: audience.name })),
            ]}
            rows={rows}
            renderCell={renderCell}
            isLoading={props.isLoading}
            emptyContent={<EmptyNotice message={props.emptyLabel} />}
        />
    )
}
