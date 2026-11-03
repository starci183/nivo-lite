import { Avatar, Cluster, DataTable, EmptyNotice, Section, Text } from "@starci/grammar/common"
import type { DataTableRow } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { Icon } from "@/components/leaves/Icon"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
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
export interface KnowledgeLaneView {
    readonly id: string
    readonly label: string
    readonly cells: Readonly<Record<string, CellView>>
}

/** The matrix as its slot carries it: who reads, and what each reads of every kind of knowledge. */
export interface MatrixView {
    readonly audiences: ReadonlyArray<AudienceView>
    readonly lanes: ReadonlyArray<KnowledgeLaneView>
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
        /** Where the audience of a document is decided: never by flipping an internal document. */
        readonly footer: string
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
    readonly lane: KnowledgeLaneView | null
}

const IDENTITY_ROW_ID = "identity"

/** What the table of one matrix draws. */
interface MatrixTableProps {
    readonly view: BrainAgentViewBaseProps["props"]
    readonly matrix: MatrixView
    readonly isLoading: boolean
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
            return audience.kind === "agent" ? (
                <AgentMark label={audience.name} seed={audience.id} src={audience.avatarUrl} size="md" />
            ) : (
                <Avatar
                    name={audience.name}
                    seed={audience.id}
                    kind="person"
                    {...(audience.avatarUrl === undefined ? {} : { src: audience.avatarUrl })}
                />
            )
        }
        if (audience === undefined) return <Text>{row.lane.label}</Text>
        const cell = row.lane.cells[audience.id]
        if (!cell?.isOpen) return <Text tone="muted">–</Text>
        return (
            <Cluster gap="inline">
                <Icon props={{ name: "copied", usage: "leading", ariaLabel: view.openLabel }} />
                {cell.count === null ? null : <Text>{String(cell.count)}</Text>}
            </Cluster>
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
            isLoading={props.isLoading}
            emptyContent={<EmptyNotice message={view.slotLabels.empty} />}
        />
    )
}

/** Draws what each audience (the customer and every installed agent) reads of the shared knowledge: a mark or a dash per cell, a comparison, so the table stands in the section with no card. */
export const BrainAgentViewBase = (props: BrainAgentViewBaseProps) => (
    <Section title={props.props.title} description={props.props.hint}>
        <SlotView
            slot={props.props.matrix}
            placeholder={MATRIX_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(matrix, isLoading) => <MatrixTable view={props.props} matrix={matrix} isLoading={isLoading} />}
        />
        <Text size="sm" tone="muted">
            {props.props.footer}
        </Text>
    </Section>
)
