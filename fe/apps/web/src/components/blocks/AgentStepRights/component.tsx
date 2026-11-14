import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Badge, EmptyNotice, Link, Stack, SurfaceCard, Text, type TableRowData } from "@starci/grammar/common"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The step that calls an operation: "workflow › step", a link to that step when its address is known. */
export interface StepRightPlaceView {
    readonly label: string
    readonly href: string | null
}

/** One row of the roll-up: an operation, its mode chip (the mode of the node that calls it) and the step that uses it. */
export interface StepRightRowView {
    readonly id: string
    readonly title: string
    /** "GET /services/expiring" for an API operation, the tool id for a native tool; null when the title already is the id. */
    readonly endpoint: string | null
    readonly chip: string
    readonly place: StepRightPlaceView
}

/** What the roll-up draws once it is read: the rows shown, how many the card holds in all, and the label of the "N more" row while some stay folded. */
export interface StepRightsView {
    readonly rows: ReadonlyArray<StepRightRowView>
    /** How many rows the card holds in all (the count chip). */
    readonly total: number
    /** the count of folded rows and a see-more command while rows are folded; null when every row shows. */
    readonly moreLabel: string | null
}

/** The words of the roll-up what the agent's steps call: its label, its note, its empty line and its three columns. */
export interface AgentStepRightsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly empty: string
        readonly columnOperation: string
        readonly columnMode: string
        readonly columnStep: string
        readonly read: {
            readonly slot: DataSlot<StepRightsView>
            readonly placeholder: StepRightsView
            readonly labels: SlotLabels
        }
    }
    readonly on: {
        readonly more: () => void
        readonly retry: () => void
    }
}

/** The props of OperationCell. */
interface OperationCellProps {
    readonly row: StepRightRowView
}

/** The operation cell: its title over the endpoint (or the tool id) in mono 12 muted. */
const OperationCell = ({ row }: OperationCellProps) => (
    <Stack gap="identity">
        <Text>{row.title}</Text>
        {row.endpoint === null ? null : (
            <Text size="xs" tone="muted" mono>
                {row.endpoint}
            </Text>
        )}
    </Stack>
)

/** The props of StepCell. */
interface StepCellProps {
    readonly place: StepRightPlaceView
}

/** The step cell: a foreground link to the step, or the plain line while its address is not known. */
const StepCell = ({ place }: StepCellProps) =>
    place.href === null ? (
        <Text>{place.label}</Text>
    ) : (
        <Link href={place.href} variant="plain">
            {place.label}
        </Link>
    )

/** One roll-up row as a table row: a plain chip, no dot. */
const rowOf = (row: StepRightRowView): TableRowData => ({
    id: row.id,
    cells: {
        operation: <OperationCell row={row} />,
        mode: <Badge tone="neutral">{row.chip}</Badge>,
        step: <StepCell place={row.place} />,
    },
})

/**
 * The agent › rights roll-up of what the agent's steps call (read-only; drawing `rights-agent-node-provider.png` screen 1, lower
 * card): a table card with the real label and column heads, skeleton rows while it is read, the rights that wait for the owner shown
 * with a muted chip, and the folded rows behind the "N more" row.
 */
export const AgentStepRightsBase = (props: AgentStepRightsBaseProps) => {
    const { title, hint, empty, read } = props.props
    return (
        <Stack gap="section">
            <SlotView
            {...read}
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <SurfaceCard
                    kind="table"
                    label={title}
                    headingLevel={2}
                    count={view.total}
                    note={hint}
                    isLoading={isLoading}
                    columns={[
                        { id: "operation", label: props.props.columnOperation, width: "fill", minWidth: 240 },
                        { id: "mode", label: props.props.columnMode, width: "fit" },
                        { id: "step", label: props.props.columnStep, width: "fit" },
                    ]}
                    rows={view.rows.map((row) => rowOf(row))}
                    empty={<EmptyNotice message={empty} />}
                    footers={view.moreLabel === null ? [] : [{ kind: "more", label: view.moreLabel, press: props.on.more }]}
                />
            )}
        />
        </Stack>
    )
}
