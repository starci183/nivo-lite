import type { BookingExceptionsData, BookingExceptionsActions } from "@/modules/types"
import { parseDate, parseTime } from "@internationalized/date"
import { Checkbox, DateField, Form, Input, Select, TimeField, Stack, Grid } from "@starci/grammar/common"
import { BookingCatalogList } from "@/components/composites/BookingCatalogList"
import { BookingSaveLine } from "@/components/branches/BookingSaveLine"

type ReadyProps = Omit<BookingExceptionsData, "slot" | "slotLabels">

type Actions = {
    readonly change: BookingExceptionsActions["onChange"]
    readonly add: BookingExceptionsActions["onAdd"]
    readonly remove: BookingExceptionsActions["onRemove"]
}

/** Resolved BookingExceptions fields and atomic commands; read status remains in its owning workbench. */
type BookingExceptionsProps = ReadyProps & {
    readonly isLoading: boolean
    readonly onChange: BookingExceptionsActions["onChange"]
    readonly onAdd: BookingExceptionsActions["onAdd"]
    readonly onRemove: BookingExceptionsActions["onRemove"]
}

/** Draws the days off and special opening hours: the list of those set and the form that adds one. */
export const BookingExceptions = (props: BookingExceptionsProps) => {
    const on = { change: props.onChange, add: props.onAdd, remove: props.onRemove }
    return (
        <>
            <Form label={props.title} isPending={props.isPending} onSubmit={on.add}>
                {renderExceptionFields(props, on, props.isLoading)}
            </Form>
            <BookingCatalogList
                label={props.title}
                emptyText={props.hint}
                rows={props.rows}
                removeLabel={props.removeLabel}
                isPending={props.isPending}
                isLoading={props.isLoading}
                onEdit={on.remove}
                onRemove={on.remove}
            />
        </>
    )
}

/** The two times of an exception's opening hours, in the order they are drawn. */
const TIME_KEYS = ["start", "end"] as const

/** The change that sets one of the two times. */
const timePatchOf = (key: (typeof TIME_KEYS)[number], time: string) =>
    key === "start" ? { start: time } : { end: time }

/** Draws the div section of the BookingExceptions view. */
const renderExceptionFields = (p: ReadyProps, on: Actions, isLoading: boolean) => {
    return (
        <Stack gap="row">
            <Grid kind="form" columns={2}>
                <Select
                    isLoading={isLoading}
                    label={p.appliesLabel}
                    options={p.applies}
                    value={p.fields.resourceId}
                    onValueChange={(resourceId) => on.change({ resourceId: resourceId ?? "all" })}
                />
                <DateField
                    isDisabled={isLoading || p.isPending}
                    label={p.dateLabel}
                    isRequired
                    value={parseDate(p.fields.date)}
                    onValueChange={(value) => {
                        if (value !== null) on.change({ date: value.toString() })
                    }}
                />
                <Input
                    isLoading={isLoading}
                    id="booking-exception-note"
                    name="note"
                    label={p.noteLabel}
                    placeholder={p.notePlaceholder}
                    value={p.fields.note}
                    onValueChange={(note) => on.change({ note })}
                />
            </Grid>
            <Checkbox
                isLoading={isLoading}
                label={p.closedLabel}
                isSelected={p.fields.closed}
                onSelectedChange={(closed) => on.change({ closed })}
            />
            {p.fields.closed ? null : (
                <Grid kind="form" columns={2}>
                    {TIME_KEYS.map((key) => (
                        <TimeField
                            key={key}
                            isDisabled={isLoading || p.isPending}
                            label={key === "start" ? p.startLabel : p.endLabel}
                            granularity="minute"
                            hourCycle={24}
                            value={parseTime(p.fields[key])}
                            onValueChange={(value) => {
                                if (value !== null) on.change(timePatchOf(key, value.toString().slice(0, 5)))
                            }}
                        />
                    ))}
                </Grid>
            )}
            <BookingSaveLine isLoading={isLoading} label={p.addLabel} isPending={p.isPending} />
        </Stack>
    )
}
