import type { BookingServicesData, BookingServicesActions } from "@/modules/types"
import { Form, Input, NumberField, Stack, Grid } from "@starci/grammar/common"
import { BookingActiveFooter } from "@/components/composites/BookingActiveFooter"
import { BookingAddButton } from "@/components/composites/BookingAddButton"
import { BookingCatalogList } from "@/components/composites/BookingCatalogList"
import { BookingRemoveDialog } from "@/components/composites/BookingRemoveDialog"

type ReadyProps = Omit<BookingServicesData, "title" | "hint">

type Actions = {
    readonly add: BookingServicesActions["onAdd"]
    readonly edit: BookingServicesActions["onEdit"]
    readonly ask: BookingServicesActions["onAsk"]
    readonly change: BookingServicesActions["onChange"]
    readonly save: BookingServicesActions["onSave"]
    readonly cancelForm: BookingServicesActions["onCancelForm"]
    readonly confirmRemove: BookingServicesActions["onConfirmRemove"]
    readonly cancelRemove: BookingServicesActions["onCancelRemove"]
}

/** Resolved BookingServices fields and atomic commands; read status remains in its owning workbench. */
type BookingServicesProps = ReadyProps & {
    readonly isLoading: boolean
    readonly onAdd: BookingServicesActions["onAdd"]
    readonly onEdit: BookingServicesActions["onEdit"]
    readonly onAsk: BookingServicesActions["onAsk"]
    readonly onChange: BookingServicesActions["onChange"]
    readonly onSave: BookingServicesActions["onSave"]
    readonly onCancelForm: BookingServicesActions["onCancelForm"]
    readonly onConfirmRemove: BookingServicesActions["onConfirmRemove"]
    readonly onCancelRemove: BookingServicesActions["onCancelRemove"]
}

/** Draws the services of the shop: the list, the add button and the form of the one being edited. */
export const BookingServices = (props: BookingServicesProps) => {
    const on = {
        add: props.onAdd,
        edit: props.onEdit,
        ask: props.onAsk,
        change: props.onChange,
        save: props.onSave,
        cancelForm: props.onCancelForm,
        confirmRemove: props.onConfirmRemove,
        cancelRemove: props.onCancelRemove,
    }
    return (
        <>
            <BookingCatalogList
                {...props.list}
                isLoading={props.isLoading}
                isPending={props.isPending}
                onEdit={on.edit}
                onRemove={on.ask}
            />
            {props.form === undefined ? (
                <BookingAddButton label={props.addLabel} isLoading={props.isLoading} onPress={on.add} />
            ) : (
                <Form label={props.form.heading} isPending={props.isPending} onSubmit={on.save}>
                    <Stack gap="row">
                        {renderServiceFields(props, on, props.isLoading)}
                        <BookingActiveFooter
                            activeLabel={props.form.activeLabel}
                            isActive={props.form.fields.active}
                            saveLabel={props.form.saveLabel}
                            cancelLabel={props.form.cancelLabel}
                            isPending={props.isPending}
                            isLoading={props.isLoading}
                            onToggle={(active) => on.change({ active })}
                            onCancel={on.cancelForm}
                        />
                    </Stack>
                </Form>
            )}

            {props.removing === undefined ? null : (
                <BookingRemoveDialog {...props.removing} onConfirm={on.confirmRemove} onCancel={on.cancelRemove} />
            )}
        </>
    )
}

/** Draws the div section of the BookingServices view. */
const renderServiceFields = (p: ReadyProps, on: Actions, isLoading: boolean) => {
    if (p.form === undefined) return null
    return (
        <Stack gap="row">
            <Grid kind="form" columns={2}>
                <Input
                    id="booking-service-name"
                    name="name"
                    isLoading={isLoading}
                    label={p.form.nameLabel}
                    isRequired
                    value={p.form.fields.name}
                    onValueChange={(name) => on.change({ name })}
                />
                <NumberField
                    label={p.form.durationLabel}
                    isLoading={isLoading}
                    minValue={5}
                    step={5}
                    value={p.form.fields.durationMin}
                    onValueChange={(durationMin) => on.change({ durationMin })}
                />
                <NumberField
                    label={p.form.bufferLabel}
                    isLoading={isLoading}
                    minValue={0}
                    step={5}
                    value={p.form.fields.bufferMin}
                    onValueChange={(bufferMin) => on.change({ bufferMin })}
                />
                <Input
                    id="booking-service-price"
                    name="price"
                    isLoading={isLoading}
                    label={p.form.priceLabel}
                    placeholder={p.form.pricePlaceholder}
                    value={p.form.fields.price}
                    onValueChange={(price) => on.change({ price })}
                />
                <Input
                    id="booking-service-kind"
                    name="resourceKind"
                    isLoading={isLoading}
                    label={p.form.kindLabel}
                    placeholder={p.form.kindPlaceholder}
                    value={p.form.fields.resourceKind}
                    onValueChange={(resourceKind) => on.change({ resourceKind })}
                />
                <Input
                    id="booking-service-followup"
                    name="followup"
                    isLoading={isLoading}
                    label={p.form.followupLabel}
                    placeholder={p.form.followupPlaceholder}
                    value={p.form.fields.followup}
                    onValueChange={(followup) => on.change({ followup })}
                />
            </Grid>
            <Input
                id="booking-service-description"
                name="description"
                isLoading={isLoading}
                label={p.form.descriptionLabel}
                value={p.form.fields.description}
                onValueChange={(description) => on.change({ description })}
            />
        </Stack>
    )
}
