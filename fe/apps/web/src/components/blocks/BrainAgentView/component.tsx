import { Avatar, DataTable, EmptyNotice, IncludedMark, SurfaceCard, Text } from "@starci/grammar/common"
import type { DataTableRow } from "@starci/grammar/common"
import { CELL_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** One audience of the matrix: the customer, or an installed agent by its human name. */
export interface AudienceView {
    readonly id: string
    readonly kind: "customer" | "agent"
    readonly name: string
    readonly avatarUrl: string | undefined
}

/** What one audience reads of one kind of knowledge. */
export interface CellView {
    readonly isOpen: boolean
    /** How many items that is, or null when it is not counted (the customer). */
    readonly count: number | null
}

/** One kind of knowledge: a row of the matrix and what every audience reads of it. */
export interface LaneView {
    readonly id: string
    readonly label: string
    readonly cells: Readonly<Record<string, CellView>>
}

/** Copy and values the connected matrix supplies. */
export interface BrainAgentViewBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly tableLabel: string
        readonly laneLabel: string
        readonly whoLabel: string
        readonly openLabel: string
        readonly emptyTitle: string
        readonly audiences: ReadonlyArray<AudienceView>
        readonly lanes: ReadonlyArray<LaneView>
        readonly isLoading: boolean
    }
}

/** One row of the table: the audiences' identities, or a kind of knowledge. */
interface MatrixRow extends DataTableRow {
    readonly lane: LaneView | null
}

const IDENTITY_ROW_ID = "identity"

/** Draws what each audience (the customer and every installed agent) reads of the shared knowledge: a mark or a dash per cell. */
export const BrainAgentViewBase = (props: BrainAgentViewBaseProps) => {
    const view = props.props
    const rows: ReadonlyArray<MatrixRow> = [
        { id: IDENTITY_ROW_ID, lane: null },
        ...view.lanes.map((lane) => ({ id: lane.id, lane })),
    ]
    const renderCell = (row: MatrixRow, columnId: string) => {
        const audience = view.audiences.find((one) => one.id === columnId)
        if (row.lane === null) {
            if (audience === undefined) return <Text tone="muted">{view.whoLabel}</Text>
            return (
                <Avatar
                    name={audience.name}
                    seed={audience.id}
                    kind={audience.kind === "agent" ? "agent" : "person"}
                    {...(audience.avatarUrl === undefined ? {} : { src: audience.avatarUrl })}
                />
            )
        }
        if (audience === undefined) return <Text>{row.lane.label}</Text>
        const cell = row.lane.cells[audience.id]
        if (!cell?.isOpen) return <Text tone="muted">–</Text>
        return (
            <div className={CELL_CLASS_NAME}>
                <IncludedMark label={view.openLabel} />
                {cell.count === null ? null : <Text>{String(cell.count)}</Text>}
            </div>
        )
    }
    return (
        <SurfaceCard label={view.title} headingLevel={2}>
            <div className={STACK_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {view.hint}
                </Text>
                <DataTable
                    label={view.tableLabel}
                    columns={[
                        { id: "lane", label: view.laneLabel, isRowHeader: true },
                        ...view.audiences.map((audience) => ({ id: audience.id, label: audience.name })),
                    ]}
                    rows={rows}
                    renderCell={renderCell}
                    isLoading={view.isLoading}
                    emptyContent={<EmptyNotice message={view.emptyTitle} />}
                />
            </div>
        </SurfaceCard>
    )
}
