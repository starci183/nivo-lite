import { parseDate, parseTime } from "@internationalized/date"
import {
    Alert,
    Button,
    Checkbox,
    DateField,
    Dialog,
    Form,
    Input,
    NumberField,
    Select,
    TimeField,
} from "@starci/grammar/common"
import { GRID_CLASS, STACK_CLASS } from "./classNames"

/** The fields of the dialog. */
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

/** What the placement dialog draws and reports: it adds a booking (every field) or moves one (when, where). */
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

/** The option that lets the database pick a free place; the field holds an empty id for it. */
export const AUTO_RESOURCE = "auto"

/** The dialog of "add booking" and "move booking": the fields, the reason of a refusal and the choice to stack anyway. */
export const BookingPlacementDialog = (props: BookingPlacementDialogProps) => {
    const { fields, labels } = props
    const adding = props.mode === "add"
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) props.onClose()
            }}
            size="md"
            title={props.title}
            closeLabel={labels.close}
            footer={
                <>
                    <Button size="sm" variant="outline" isDisabled={props.isPending} onPress={props.onClose}>
                        {labels.cancel}
                    </Button>
                    <Button
                        size="sm"
                        variant="primary"
                        isPending={props.isPending}
                        isDisabled={
                            props.isPending || (adding && (fields.name.trim() === "" || fields.serviceId === ""))
                        }
                        onPress={props.onSubmit}
                    >
                        {labels.save}
                    </Button>
                </>
            }
        >
            <Form label={props.title} isPending={props.isPending} onSubmit={props.onSubmit}>
                <div className={STACK_CLASS}>
                    <div className={GRID_CLASS}>
                        {adding ? (
                            <>
                                <Input
                                    id="booking-place-name"
                                    name="name"
                                    label={labels.name}
                                    variant="secondary"
                                    isRequired
                                    value={fields.name}
                                    onValueChange={(name) => props.onChange({ name })}
                                />
                                <Input
                                    id="booking-place-phone"
                                    name="phone"
                                    kind="tel"
                                    label={labels.phone}
                                    variant="secondary"
                                    value={fields.phone}
                                    onValueChange={(phone) => props.onChange({ phone })}
                                />
                                <Select
                                    label={labels.service}
                                    variant="secondary"
                                    options={props.serviceOptions}
                                    value={fields.serviceId}
                                    onValueChange={(serviceId) => props.onChange({ serviceId: serviceId ?? "" })}
                                />
                            </>
                        ) : null}
                        <DateField
                            label={labels.date}
                            variant="secondary"
                            isRequired
                            value={parseDate(fields.date)}
                            onValueChange={(value) => {
                                if (value !== null) props.onChange({ date: value.toString() })
                            }}
                        />
                        <TimeField
                            label={labels.time}
                            variant="secondary"
                            granularity="minute"
                            hourCycle={24}
                            value={parseTime(fields.time)}
                            onValueChange={(value) => {
                                if (value !== null) props.onChange({ time: value.toString().slice(0, 5) })
                            }}
                        />
                        <Select
                            label={labels.resource}
                            variant="secondary"
                            options={props.resourceOptions}
                            value={fields.resourceId === "" ? AUTO_RESOURCE : fields.resourceId}
                            onValueChange={(resourceId) =>
                                props.onChange({
                                    resourceId: resourceId === null || resourceId === AUTO_RESOURCE ? "" : resourceId,
                                })
                            }
                        />
                        {adding ? (
                            <>
                                <NumberField
                                    label={labels.party}
                                    variant="secondary"
                                    minValue={1}
                                    maxValue={20}
                                    step={1}
                                    value={fields.party}
                                    onValueChange={(party) =>
                                        props.onChange({ party: Number.isFinite(party) ? Math.max(1, party) : 1 })
                                    }
                                />
                                <Input
                                    id="booking-place-note"
                                    name="note"
                                    label={labels.note}
                                    variant="secondary"
                                    placeholder={labels.notePlaceholder}
                                    value={fields.note}
                                    onValueChange={(note) => props.onChange({ note })}
                                />
                            </>
                        ) : null}
                    </div>
                    {props.refusal === undefined ? null : <Alert tone="negative" title={props.refusal} />}
                    {props.canForce || fields.force ? (
                        <Checkbox
                            variant="secondary"
                            label={labels.force}
                            isSelected={fields.force}
                            onSelectedChange={(force) => props.onChange({ force })}
                        />
                    ) : null}
                </div>
            </Form>
        </Dialog>
    )
}
