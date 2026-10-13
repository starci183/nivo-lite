import { Alert, Button, Form, Input, NumberField, Select, SectionHeader } from "@starci/grammar/common"
import { BookingActiveFooter } from "@/components/composites/BookingActiveFooter"
import { BookingAddButton } from "@/components/composites/BookingAddButton"
import { BookingCatalogList } from "@/components/composites/BookingCatalogList"
import { BookingRemoveDialog } from "@/components/composites/BookingRemoveDialog"
import { BookingSetupSection } from "@/components/composites/BookingSetupSection"
import { GRID_CLASS, STACK_CLASS } from "./classNames"

/** The fields of the resource form. */
export interface ResourceFields {
    readonly name: string
    readonly kind: string
    readonly capacity: number
    readonly active: boolean
    readonly staffId: string
}

/** Props for {@link BookingResourcesBase}. */
export interface BookingResourcesBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly list: {
            readonly label: string
            readonly emptyText: string
            readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
            readonly editLabel: string
            readonly removeLabel: string
        }
        readonly addLabel: string
        readonly form?: {
            readonly heading: string
            readonly fields: ResourceFields
            readonly nameLabel: string
            readonly kindLabel: string
            readonly capacityLabel: string
            readonly activeLabel: string
            readonly staffLabel: string
            readonly staffOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
            readonly hoursHeading: string
            readonly hoursHint: string
            readonly hours: ReadonlyArray<{ readonly day: number; readonly label: string; readonly value: string }>
            readonly hoursPlaceholder: string
            readonly saveLabel: string
            readonly saveHoursLabel: string
            readonly cancelLabel: string
            readonly canSaveHours: boolean
        }
        readonly removing?: {
            readonly title: string
            readonly description: string
            readonly confirmLabel: string
            readonly cancelLabel: string
        }
        readonly isPending: boolean
        readonly notice?: { readonly tone: "affirmative" | "negative"; readonly text: string }
    }
    readonly on: {
        readonly add: () => void
        readonly edit: (id: string) => void
        readonly ask: (id: string) => void
        readonly change: (patch: Partial<ResourceFields>) => void
        readonly changeHours: (day: number, value: string) => void
        readonly save: () => void
        readonly saveHours: () => void
        readonly cancelForm: () => void
        readonly confirmRemove: () => void
        readonly cancelRemove: () => void
    }
}

/** Draws the people and rooms of the shop: the list, the form of the one being edited and its weekly hours. */
export const BookingResourcesBase = (props: BookingResourcesBaseProps) => {
    const { props: p, on } = props
    return (
        <BookingSetupSection title={p.title} hint={p.hint}>
            <BookingCatalogList onRemove={on.ask} onEdit={on.edit} isPending={p.isPending} {...p.list} />
            {p.form === undefined ? (
                <BookingAddButton label={p.addLabel} onPress={on.add} />
            ) : (
                <div className={STACK_CLASS}>
                    <Form label={p.form.heading} isPending={p.isPending} onSubmit={on.save}>
                        <div className={STACK_CLASS}>
                            <div className={GRID_CLASS}>
                                <Input
                                    id="booking-resource-name"
                                    autoFocus
                                    name="name"
                                    label={p.form.nameLabel}
                                    variant="secondary"
                                    isRequired
                                    value={p.form.fields.name}
                                    onValueChange={(name) => on.change({ name })}
                                />
                                <Input
                                    id="booking-resource-kind"
                                    name="kind"
                                    label={p.form.kindLabel}
                                    variant="secondary"
                                    value={p.form.fields.kind}
                                    onValueChange={(kind) => on.change({ kind })}
                                />
                                <NumberField
                                    label={p.form.capacityLabel}
                                    variant="secondary"
                                    minValue={1}
                                    step={1}
                                    value={p.form.fields.capacity}
                                    onValueChange={(capacity) => on.change({ capacity })}
                                />
                                {p.form.staffOptions.length > 1 ? (
                                    <Select
                                        label={p.form.staffLabel}
                                        variant="secondary"
                                        options={p.form.staffOptions}
                                        value={p.form.fields.staffId}
                                        onValueChange={(staffId) => on.change({ staffId: staffId ?? "none" })}
                                    />
                                ) : null}
                            </div>
                            <BookingActiveFooter
                                onCancel={on.cancelForm}
                                onToggle={(active) => on.change({ active })}
                                isPending={p.isPending}
                                cancelLabel={p.form.cancelLabel}
                                saveLabel={p.form.saveLabel}
                                isActive={p.form.fields.active}
                                activeLabel={p.form.activeLabel}
                            />
                        </div>
                    </Form>
                    {p.form.canSaveHours ? (
                        <div className={STACK_CLASS}>
                            <SectionHeader level={3} title={p.form.hoursHeading} description={p.form.hoursHint} />
                            <div className={GRID_CLASS}>
                                {p.form.hours.map((day) => (
                                    <Input
                                        key={day.day}
                                        id={`booking-resource-hours-${day.day}`}
                                        name={`hours${day.day}`}
                                        label={day.label}
                                        variant="secondary"
                                        placeholder={p.form?.hoursPlaceholder}
                                        value={day.value}
                                        onValueChange={(value) => on.changeHours(day.day, value)}
                                    />
                                ))}
                            </div>
                            <div>
                                <Button size="sm" variant="primary" isPending={p.isPending} onPress={on.saveHours}>
                                    {p.form.saveHoursLabel}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
            {p.notice === undefined ? null : <Alert tone={p.notice.tone} title={p.notice.text} />}
            {p.removing === undefined ? null : (
                <BookingRemoveDialog {...p.removing} onConfirm={on.confirmRemove} onCancel={on.cancelRemove} />
            )}
        </BookingSetupSection>
    )
}
