import { ShiftsFormCard } from "@/components/composites/ShiftsFormCard"
import type { ShiftsFormView } from "@/components/composites/ShiftsFormCard"

/** Copy, fields and rows the connected availability card supplies. */
export interface ShiftsAvailabilityBaseProps {
    readonly props: ShiftsFormView
    readonly on: {
        readonly field: (id: string, value: string) => void
        readonly available: (value: boolean) => void
        readonly submit: () => void
        readonly remove: (id: string) => void
    }
}

/** Draws the form that enters a person's availability and the list of approved rows with remove. */
export const ShiftsAvailabilityBase = (props: ShiftsAvailabilityBaseProps) => (
    <ShiftsFormCard
        {...props.props}
        onField={props.on.field}
        onSwitch={props.on.available}
        onSubmit={props.on.submit}
        onRowAction={props.on.remove}
    />
)
