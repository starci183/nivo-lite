import { BookingCustomerFields } from "@/components/leaves/BookingCustomerFields"
import type { BookingPlacementDialogProps } from "@/components/leaves/BookingCustomerFields"
export type { BookingPlacementDialogProps } from "@/components/leaves/BookingCustomerFields"
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
            footer={renderBookingPlacementDialogFooter(props, labels, adding, fields)}
        >
            <Form label={props.title} isPending={props.isPending} onSubmit={props.onSubmit}>
                <div className={STACK_CLASS}>
                    <div className={GRID_CLASS}>
                        {adding ? <BookingCustomerFields {...props} /> : null}
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
                        {adding ? renderBookingPlacementDialogPartyFields(labels, fields, props) : null}
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

/** Renders the BookingPlacementDialog party fields section. */
const renderBookingPlacementDialogPartyFields = (
    labels: NonNullable<BookingPlacementDialogProps["labels"]>,
    fields: NonNullable<BookingPlacementDialogProps["fields"]>,
    props: BookingPlacementDialogProps,
) => (
    <>
        <NumberField
            label={labels.party}
            variant="secondary"
            minValue={1}
            maxValue={20}
            step={1}
            value={fields.party}
            onValueChange={(party) => props.onChange({ party: Number.isFinite(party) ? Math.max(1, party) : 1 })}
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
)

/** Renders the BookingPlacementDialog footer section. */
const renderBookingPlacementDialogFooter = (
    props: Pick<BookingPlacementDialogProps, "isPending" | "onClose" | "onSubmit">,
    labels: NonNullable<BookingPlacementDialogProps["labels"]>,
    adding: boolean,
    fields: NonNullable<BookingPlacementDialogProps["fields"]>,
) => (
    <>
        <Button size="sm" variant="outline" isDisabled={props.isPending} onPress={props.onClose}>
            {labels.cancel}
        </Button>
        <Button
            size="sm"
            variant="primary"
            isPending={props.isPending}
            isDisabled={props.isPending || (adding && (fields.name.trim() === "" || fields.serviceId === ""))}
            onPress={props.onSubmit}
        >
            {labels.save}
        </Button>
    </>
)
