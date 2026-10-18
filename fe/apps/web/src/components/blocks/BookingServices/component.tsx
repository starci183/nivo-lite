import { Alert, Form, Input, NumberField } from "@starci/grammar/common"
import { BookingActiveFooter } from "@/components/composites/BookingActiveFooter"
import { BookingAddButton } from "@/components/composites/BookingAddButton"
import { BookingCatalogList } from "@/components/composites/BookingCatalogList"
import { BookingRemoveDialog } from "@/components/composites/BookingRemoveDialog"
import { BookingSetupSection } from "@/components/composites/BookingSetupSection"
import { GRID_CLASS, STACK_CLASS, WIDE_CLASS } from "./classNames"

/** The fields of the service form. */
export interface ServiceFields {
    readonly name: string
    readonly durationMin: number
    readonly bufferMin: number
    readonly price: string
    readonly resourceKind: string
    readonly followup: string
    readonly description: string
    readonly active: boolean
}

/** Props for {@link BookingServicesBase}. */
export interface BookingServicesBaseProps {
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
            readonly fields: ServiceFields
            readonly nameLabel: string
            readonly durationLabel: string
            readonly bufferLabel: string
            readonly priceLabel: string
            readonly pricePlaceholder: string
            readonly kindLabel: string
            readonly kindPlaceholder: string
            readonly followupLabel: string
            readonly followupPlaceholder: string
            readonly descriptionLabel: string
            readonly activeLabel: string
            readonly saveLabel: string
            readonly cancelLabel: string
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
        readonly change: (patch: Partial<ServiceFields>) => void
        readonly save: () => void
        readonly cancelForm: () => void
        readonly confirmRemove: () => void
        readonly cancelRemove: () => void
    }
}

/** Draws the services of the shop: the list, the add button and the form of the one being edited. */
export const BookingServicesBase = (props: BookingServicesBaseProps) => {
    const { props: p, on } = props
    return (
        <BookingSetupSection title={p.title} hint={p.hint}>
            <BookingCatalogList {...p.list} isPending={p.isPending} onEdit={on.edit} onRemove={on.ask} />
            {p.form === undefined ? (
                <BookingAddButton label={p.addLabel} onPress={on.add} />
            ) : (
                <Form label={p.form.heading} isPending={p.isPending} onSubmit={on.save}>
                    <div className={STACK_CLASS}>
                        {renderServiceFields(p, on)}
                        <BookingActiveFooter
                            activeLabel={p.form.activeLabel}
                            isActive={p.form.fields.active}
                            saveLabel={p.form.saveLabel}
                            cancelLabel={p.form.cancelLabel}
                            isPending={p.isPending}
                            onToggle={(active) => on.change({ active })}
                            onCancel={on.cancelForm}
                        />
                    </div>
                </Form>
            )}
            {p.notice === undefined ? null : <Alert tone={p.notice.tone} title={p.notice.text} />}
            {p.removing === undefined ? null : (
                <BookingRemoveDialog {...p.removing} onConfirm={on.confirmRemove} onCancel={on.cancelRemove} />
            )}
        </BookingSetupSection>
    )
}

/** Draws the div section of the BookingServices view. */
const renderServiceFields = (p: BookingServicesBaseProps["props"], on: BookingServicesBaseProps["on"]) => {
    if (p.form === undefined) return null
    return (
        <div className={GRID_CLASS}>
            <Input
                id="booking-service-name"
                name="name"
                label={p.form.nameLabel}
                variant="secondary"
                isRequired
                value={p.form.fields.name}
                onValueChange={(name) => on.change({ name })}
            />
            <NumberField
                label={p.form.durationLabel}
                variant="secondary"
                minValue={5}
                step={5}
                value={p.form.fields.durationMin}
                onValueChange={(durationMin) => on.change({ durationMin })}
            />
            <NumberField
                label={p.form.bufferLabel}
                variant="secondary"
                minValue={0}
                step={5}
                value={p.form.fields.bufferMin}
                onValueChange={(bufferMin) => on.change({ bufferMin })}
            />
            <Input
                id="booking-service-price"
                name="price"
                label={p.form.priceLabel}
                variant="secondary"
                placeholder={p.form.pricePlaceholder}
                value={p.form.fields.price}
                onValueChange={(price) => on.change({ price })}
            />
            <Input
                id="booking-service-kind"
                name="resourceKind"
                label={p.form.kindLabel}
                variant="secondary"
                placeholder={p.form.kindPlaceholder}
                value={p.form.fields.resourceKind}
                onValueChange={(resourceKind) => on.change({ resourceKind })}
            />
            <Input
                id="booking-service-followup"
                name="followup"
                label={p.form.followupLabel}
                variant="secondary"
                placeholder={p.form.followupPlaceholder}
                value={p.form.fields.followup}
                onValueChange={(followup) => on.change({ followup })}
            />
            <div className={WIDE_CLASS}>
                <Input
                    id="booking-service-description"
                    name="description"
                    label={p.form.descriptionLabel}
                    variant="secondary"
                    value={p.form.fields.description}
                    onValueChange={(description) => on.change({ description })}
                />
            </div>
        </div>
    )
}

/** The initial values of a new booking service. */
export const BLANK_SERVICE_FIELDS: ServiceFields = {
    name: "",
    durationMin: 30,
    bufferMin: 0,
    price: "",
    resourceKind: "",
    followup: "",
    description: "",
    active: true,
}

/** Reads a whole VND or day count from its editable text. */
export const bookingServiceDigits = (value: string): number | null => {
    const only = value.replace(/[^\d]/gu, "")
    return only === "" ? null : Number(only)
}

/** Stored service values whose amounts are converted to editable text. */
interface StoredServiceFields extends Omit<ServiceFields, "price" | "followup" | "resourceKind"> {
    readonly priceVnd: number | null
    readonly followupDays: number | null
    readonly resourceKind: string | null
}

/** Converts stored numeric amounts to the text fields owned by this form. */
export const serviceFieldsOf = (service: StoredServiceFields): ServiceFields => ({
    name: service.name,
    durationMin: service.durationMin,
    bufferMin: service.bufferMin,
    price: service.priceVnd === null ? "" : String(service.priceVnd),
    resourceKind: service.resourceKind ?? "",
    followup: service.followupDays === null ? "" : String(service.followupDays),
    description: service.description,
    active: service.active,
})
