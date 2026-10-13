import { ShiftsFormCard } from "@/components/composites/ShiftsFormCard"
import type { ShiftsFormView } from "@/components/composites/ShiftsFormCard"

/** Copy, fields and rows the connected availability card supplies. */
export interface ShiftsMyAvailabilityBaseProps {
    readonly props: ShiftsFormView
    readonly on: {
        readonly field: (id: string, value: string) => void
        readonly available: (value: boolean) => void
        readonly submit: () => void
    }
}

/** Draws the availability form and my latest availability rows with their state. */
export const ShiftsMyAvailabilityBase = (props: ShiftsMyAvailabilityBaseProps) => (
    <ShiftsFormCard
        {...props.props}
        onField={props.on.field}
        onSwitch={props.on.available}
        onSubmit={props.on.submit}
    />
)
