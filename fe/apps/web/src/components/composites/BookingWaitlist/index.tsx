import type { BookingWaitlistData, BookingWaitlistActions } from "@/modules/types"
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"

type ReadyProps = Omit<BookingWaitlistData, "slot" | "slotLabels">

/** Resolved BookingWaitlist fields and atomic commands; read status remains in its owning workbench. */
type BookingWaitlistProps = ReadyProps & {
    readonly isLoading: boolean
    readonly onRemove: BookingWaitlistActions["onRemove"]
}

/** Draws the waiting list: who waits for a free time, and the button that takes them off. */
export const BookingWaitlist = (props: BookingWaitlistProps) => (
    <SurfaceCard
        kind="list"
        isLoading={props.isLoading}
        label={props.label}
        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
        items={props.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.detail,
            action: {
                label: props.removeLabel,
                isDisabled: props.isPending,
                press: () => props.onRemove(row.id),
            },
        }))}
    />
)
