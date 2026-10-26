import { Input, Select } from "@starci/grammar/common"
type BookingPlacementFields = {
    readonly serviceId: string
    readonly date: string
    readonly time: string
    readonly resourceId: string
    readonly name: string
    readonly phone: string
    readonly party: number
    readonly note: string
    readonly force: boolean
}

/** The booking placement fields, labels, submission and dismissal commands. */
export type BookingPlacementDialogProps = {
    readonly mode: "add" | "move"
    readonly title: string
    readonly fields: BookingPlacementFields
    readonly serviceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly resourceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly labels: {
        readonly name: string
        readonly phone: string
        readonly service: string
        readonly date: string
        readonly time: string
        readonly resource: string
        readonly party: string
        readonly note: string
        readonly notePlaceholder: string
        readonly force: string
        readonly save: string
        readonly cancel: string
        readonly close: string
    }
    /** The reason the last try was refused, in words. */
    readonly refusal?: string
    /** Whether the owner may stack the booking anyway. */
    readonly canForce: boolean
    readonly isPending: boolean
    readonly onChange: (patch: Partial<BookingPlacementFields>) => void
    readonly onSubmit: () => void
    readonly onClose: () => void
}

/** Customer and service inputs when adding a booking. */
type BookingCustomerFieldsProps = Pick<BookingPlacementDialogProps, "labels" | "fields" | "serviceOptions" | "onChange">
/** Renders the customer and service fields of a new booking. */
export const BookingCustomerFields = (props: BookingCustomerFieldsProps) => {
    const { labels, fields } = props
    return (
        <>
            <Input
                id="booking-place-name"
                name="name"
                label={labels.name}
                isRequired
                value={fields.name}
                onValueChange={(name) => props.onChange({ name })}
            />
            <Input
                id="booking-place-phone"
                name="phone"
                kind="tel"
                label={labels.phone}
                value={fields.phone}
                onValueChange={(phone) => props.onChange({ phone })}
            />
            <Select
                label={labels.service}
                options={props.serviceOptions}
                value={fields.serviceId}
                onValueChange={(serviceId) => props.onChange({ serviceId: serviceId ?? "" })}
            />
        </>
    )
}
