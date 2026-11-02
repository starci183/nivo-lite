import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
type ShiftsOpenShiftsProps = ShiftsPersonalViews["openShifts"] & {
    readonly on: ShiftsPersonalActions["openShifts"] | undefined
    readonly isLoading?: boolean
}
import { EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"

/** Draws the open shifts with a button to ask for each. */
export const ShiftsOpenShifts = (props: ShiftsOpenShiftsProps) => (
    <SurfaceCard
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        kind="list"
        label={props.title}
        headingLevel={2}
        footer={
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.hint}
            </Text>
        }
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
