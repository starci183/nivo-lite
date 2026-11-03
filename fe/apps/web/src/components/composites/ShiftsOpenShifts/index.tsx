import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
type ShiftsOpenShiftsProps = ShiftsPersonalViews["openShifts"] & {
    readonly on: ShiftsPersonalActions["openShifts"] | undefined
    readonly isLoading?: boolean
}
import { EmptyNotice } from "@starci/grammar/common"
import { ShiftsListCard } from "@/components/branches/ShiftsListCard"

/** Draws the open shifts with a button to ask for each. */
export const ShiftsOpenShifts = (props: ShiftsOpenShiftsProps) => (
    <ShiftsListCard
        title={props.title}
        hint={props.hint}
        isLoading={props.isLoading}
        empty={<EmptyNotice message={props.emptyLabel} />}
        items={props.shifts.map((shift) => ({
            id: shift.id,
            title: shift.title,
            description: shift.notes.filter((note) => note !== "").join(" · "),
            action: {
                label: props.claimLabel,
                intent: "neutral",
                isPending: shift.isBusy,
                press: () => props.on?.claim(shift.id),
            },
        }))}
    />
)
