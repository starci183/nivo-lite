import { ShiftsFormCard } from "@/components/composites/ShiftsFormCard"
import type { ShiftsFormView } from "@/components/composites/ShiftsFormCard"

/** Copy, fields and requests the connected leave card supplies. */
export interface ShiftsLeaveBaseProps {
    readonly props: ShiftsFormView
    readonly on: {
        readonly field: (id: string, value: string) => void
        readonly submit: () => void
    }
}

/** Draws the leave form and my latest leave requests. */
export const ShiftsLeaveBase = (props: ShiftsLeaveBaseProps) => (
    <ShiftsFormCard {...props.props} onField={props.on.field} onSubmit={props.on.submit} />
)
