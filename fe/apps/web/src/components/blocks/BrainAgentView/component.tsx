import { Avatar, DataTable, IncludedMark, SectionHeader, Stack, Text } from "@starci/grammar/common"
import type { DataTableRow } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { CELL_CLASS_NAME } from "./classNames"

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

/** The matrix as its slot carries it: who reads, and what each reads of every kind of knowledge. */
export interface MatrixView {
    readonly audiences: ReadonlyArray<AudienceView>
    readonly lanes: ReadonlyArray<LaneView>
}

/** A matrix of the same shape as a ready one: the customer and an agent against four kinds of knowledge. */
const MATRIX_PLACEHOLDER: MatrixView = {
    audiences: [
        { id: "customer", kind: "customer", name: "-", avatarUrl: undefined },
        { id: "agent", kind: "agent", name: "-", avatarUrl: undefined },
    ],
    lanes: ["a", "b", "c", "d"].map((id) => ({ id, label: "-", cells: {} })),
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
        readonly matrix: DataSlot<MatrixView>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** One row of the table: the audiences' identities, or a kind of knowledge. */
interface MatrixRow extends DataTableRow {
    readonly lane: LaneView | null
}

const IDENTITY_ROW_ID = "identity"

/** What the table of one matrix draws. */
interface MatrixTableProps {
    readonly view: BrainAgentViewBaseProps["props"]
    readonly matrix: MatrixView
    readonly isSkeleton: boolean
}

/** Draws the table of one matrix: the identities of the audiences, then a mark or a dash per cell. */
const MatrixTable = (props: MatrixTableProps) => {
    const { view, matrix } = props
    const rows: ReadonlyArray<MatrixRow> = [
        { id: IDENTITY_ROW_ID, lane: null },
        ...matrix.lanes.map((lane) => ({ id: lane.id, lane })),
    ]
    const renderCell = (row: MatrixRow, columnId: string) => {
        const audience = matrix.audiences.find((one) => one.id === columnId)
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
        <DataTable
            label={view.tableLabel}
            columns={[
                { id: "lane", label: view.laneLabel, isRowHeader: true },
                ...matrix.audiences.map((audience) => ({ id: audience.id, label: audience.name })),
            ]}
            rows={rows}
            renderCell={renderCell}
            isLoading={props.isSkeleton}
            loadingRows={rows.length}
            emptyContent={null}
        />
    )
}

/** Draws what each audience (the customer and every installed agent) reads of the shared knowledge: a mark or a dash per cell, a comparison, so the table stands in the section with no card. */
export const BrainAgentViewBase = (props: BrainAgentViewBaseProps) => (
    <Stack gap="row">
        <SectionHeader level={2} title={props.props.title} />
        <SlotView
            slot={props.props.matrix}
            placeholder={MATRIX_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(matrix, isSkeleton) => <MatrixTable view={props.props} matrix={matrix} isSkeleton={isSkeleton} />}
        </SlotView>
        <Text size="sm" tone="muted">
            {props.props.hint}
        </Text>
    </Stack>
)
