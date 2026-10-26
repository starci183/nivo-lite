import { Button, EmptyNotice, ListRow, SectionHeader, SurfaceListCard } from "@starci/grammar/common"
import { SECTION_CLASS_NAME } from "./classNames"

/** Copy and shifts the connected open-shift list supplies. */
export interface ShiftsOpenShiftsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly emptyLabel: string
        readonly claimLabel: string
        readonly shifts: ReadonlyArray<{
            readonly id: string
            readonly title: string
            readonly notes: ReadonlyArray<string>
            readonly isBusy: boolean
        }>
    }
    readonly on: {
        readonly claim: (id: string) => void
    }
}

/** Draws the open shifts with a button to ask for each. */
export const ShiftsOpenShiftsBase = (props: ShiftsOpenShiftsBaseProps) => (
    <div className={SECTION_CLASS_NAME}>
        <SectionHeader level={2} title={props.props.title} description={props.props.hint} />
        <SurfaceListCard ariaLabel={props.props.title} empty={<EmptyNotice message={props.props.emptyLabel} />}>
            {props.props.shifts.map((shift) => (
                <ListRow
                    key={shift.id}
                    title={shift.title}
                    description={shift.notes.filter((note) => note !== "").join(" · ")}
                    actions={
                        <Button
                            size="sm"
                            intent="neutral"
                            isPending={shift.isBusy}
                            onPress={() => props.on.claim(shift.id)}
                        >
                            {props.props.claimLabel}
                        </Button>
                    }
                />
            ))}
        </SurfaceListCard>
    </div>
)
