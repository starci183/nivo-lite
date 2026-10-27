import { Button, EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link BookingWaitlistBase}. */
export interface BookingWaitlistBaseProps {
    readonly props: {
        /** The booking board read behind the block. */
        readonly slot: DataSlot<true>
        readonly slotLabels: SlotLabels
        readonly label: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly removeLabel: string
        readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
        readonly isPending: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly remove: (id: string) => void
    }
}

/** Draws the waiting list: who waits for a free time, and the button that takes them off. */
const BookingWaitlistBody = (props: BookingWaitlistBaseProps) => (
    <SurfaceListCard
        ariaLabel={props.props.label}
        empty={<EmptyNotice message={props.props.emptyTitle} description={props.props.emptyBody} />}
    >
        {props.props.rows.map((row) => (
            <ListRow
                key={row.id}
                title={row.title}
                description={row.detail}
                actions={
                    <Button
                        size="sm"
                        intent="destructive"
                        step="entry"
                        isDisabled={props.props.isPending}
                        onPress={() => props.on.remove(row.id)}
                    >
                        {props.props.removeLabel}
                    </Button>
                }
            />
        ))}
    </SurfaceListCard>
)

/** Draws the block once the booking board is read; until then the same form draws, its controls resting. */
export const BookingWaitlistBase = (props: BookingWaitlistBaseProps) => (
    <SlotView slot={props.props.slot} placeholder labels={props.props.slotLabels} onRetry={props.on.retry}>
        {() => <BookingWaitlistBody {...props} />}
    </SlotView>
)
