import { AUTO_RESOURCE } from "@/hooks/bookingDesk"
import { BookingCustomerFields, type BookingPlacementDialogProps } from "@/components/leaves/BookingCustomerFields"
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
    Stack,
    Grid,
} from "@starci/grammar/common"

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
                <Stack gap="row">
                    <Grid kind="form" columns={2}>
                        {adding ? <BookingCustomerFields {...props} /> : null}
                        <DateField
                            label={labels.date}
                            isRequired
                            value={parseDate(fields.date)}
                            onValueChange={(value) => {
                                if (value !== null) props.onChange({ date: value.toString() })
                            }}
                        />
                        <TimeField
                            label={labels.time}
                            granularity="minute"
                            hourCycle={24}
                            value={parseTime(fields.time)}
                            onValueChange={(value) => {
                                if (value !== null) props.onChange({ time: value.toString().slice(0, 5) })
                            }}
                        />
                        <Select
                            label={labels.resource}
                            options={props.resourceOptions}
                            value={fields.resourceId === "" ? AUTO_RESOURCE : fields.resourceId}
                            onValueChange={(resourceId) =>
                                props.onChange({
                                    resourceId: resourceId === null || resourceId === AUTO_RESOURCE ? "" : resourceId,
                                })
                            }
                        />
                        {adding ? renderBookingPlacementDialogPartyFields(labels, fields, props) : null}
                    </Grid>
                    {props.refusal === undefined ? null : <Alert tone="negative" title={props.refusal} />}
                    {props.canForce || fields.force ? (
                        <Checkbox
                            label={labels.force}
                            isSelected={fields.force}
                            onSelectedChange={(force) => props.onChange({ force })}
                        />
                    ) : null}
                </Stack>
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
        <Button size="sm" intent="neutral" isDisabled={props.isPending} onPress={props.onClose}>
            {labels.cancel}
        </Button>
        <Button
            size="sm"
            intent="commit"
            isPending={props.isPending}
            isDisabled={props.isPending || (adding && (fields.name.trim() === "" || fields.serviceId === ""))}
            onPress={props.onSubmit}
        >
            {labels.save}
        </Button>
    </>
)
