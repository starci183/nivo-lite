import { SlotView } from "@/components/composites/SlotView"
import { WorkbenchWaitingList, type WorkbenchWaitingListProps } from "@/components/composites/WorkbenchWaitingList"
import type { DataSlot, SlotLabels, WorkbenchRowView } from "@/modules/types"

/** Props for {@link SalesWaitingBase}. */
export interface SalesWaitingBaseProps {
    readonly props: {
        readonly slot: DataSlot<ReadonlyArray<WorkbenchRowView>>
        readonly slotLabels: SlotLabels
        /** One empty row, drawn as a skeleton while the rows are read. */
        readonly placeholder: ReadonlyArray<WorkbenchRowView>
        /** The words and counts of the card; the rows come from the slot. */
        readonly list: Omit<WorkbenchWaitingListProps, "surface" | "items" | "isSkeleton">
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the "waiting for you" card of the Sales workbench: the decisions that wait for a person, each decided in place. */
export const SalesWaitingBase = (props: SalesWaitingBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(rows, isSkeleton) => (
            <WorkbenchWaitingList
                {...props.props.list}
                surface="card"
                items={rows.map((row) => ({ row }))}
                isSkeleton={isSkeleton}
            />
        )}
    </SlotView>
)
