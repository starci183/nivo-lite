import { parseDate, parseTime } from "@internationalized/date"
import { Checkbox, DateField, Form, Input, Select, TimeField } from "@starci/grammar/common"
import { BookingCatalogList } from "@/components/composites/BookingCatalogList"
import { BookingSaveLine } from "@/components/composites/BookingSaveLine"
import { BookingSetupSection } from "@/components/composites/BookingSetupSection"
import { GRID_CLASS, STACK_CLASS } from "./classNames"

/** The fields of the exception form. */
export interface ExceptionFields {
    readonly resourceId: string
    readonly date: string
    readonly closed: boolean
    readonly start: string
    readonly end: string
    readonly note: string
}

/** Props for {@link BookingExceptionsBase}. */
export interface BookingExceptionsBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
        readonly removeLabel: string
        readonly fields: ExceptionFields
        readonly appliesLabel: string
        readonly applies: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly dateLabel: string
        readonly noteLabel: string
        readonly notePlaceholder: string
        readonly closedLabel: string
        readonly startLabel: string
        readonly endLabel: string
        readonly addLabel: string
        readonly isPending: boolean
        readonly notice?: { readonly tone: "affirmative" | "negative"; readonly text: string }
    }
    readonly on: {
        readonly change: (patch: Partial<ExceptionFields>) => void
        readonly add: () => void
        readonly remove: (id: string) => void
    }
}

/** Draws the days off and special opening hours: the list of those set and the form that adds one. */
export const BookingExceptionsBase = (props: BookingExceptionsBaseProps) => {
    const { props: p, on } = props
    return (
        <BookingSetupSection title={p.title} hint={p.hint}>
            <Form label={p.title} isPending={p.isPending} onSubmit={on.add}>
                <div className={STACK_CLASS}>
                    <div className={GRID_CLASS}>
                        <Select
                            label={p.appliesLabel}
                            variant="secondary"
                            options={p.applies}
                            value={p.fields.resourceId}
                            onValueChange={(resourceId) => on.change({ resourceId: resourceId ?? "all" })}
                        />
                        <DateField
                            label={p.dateLabel}
                            variant="secondary"
                            isRequired
                            value={parseDate(p.fields.date)}
                            onValueChange={(value) => {
                                if (value !== null) on.change({ date: value.toString() })
                            }}
                        />
                        <Input
                            id="booking-exception-note"
                            name="note"
                            label={p.noteLabel}
                            variant="secondary"
                            placeholder={p.notePlaceholder}
                            value={p.fields.note}
                            onValueChange={(note) => on.change({ note })}
                        />
                    </div>
                    <Checkbox
                        variant="secondary"
                        label={p.closedLabel}
                        isSelected={p.fields.closed}
                        onSelectedChange={(closed) => on.change({ closed })}
                    />
                    {p.fields.closed ? null : (
                        <div className={GRID_CLASS}>
                            <TimeField
                                label={p.startLabel}
                                variant="secondary"
                                granularity="minute"
                                hourCycle={24}
                                value={parseTime(p.fields.start)}
                                onValueChange={(value) => {
                                    if (value !== null) on.change({ start: value.toString().slice(0, 5) })
                                }}
                            />
                            <TimeField
                                label={p.endLabel}
                                variant="secondary"
                                granularity="minute"
                                hourCycle={24}
                                value={parseTime(p.fields.end)}
                                onValueChange={(value) => {
                                    if (value !== null) on.change({ end: value.toString().slice(0, 5) })
                                }}
                            />
                        </div>
                    )}
                    <BookingSaveLine
                        label={p.addLabel}
                        isPending={p.isPending}
                        {...(p.notice === undefined ? {} : { notice: p.notice })}
                    />
                </div>
            </Form>
            <BookingCatalogList
                label={p.title}
                emptyText={p.hint}
                rows={p.rows}
                removeLabel={p.removeLabel}
                isPending={p.isPending}
                onEdit={on.remove}
                onRemove={on.remove}
            />
        </BookingSetupSection>
    )
}
