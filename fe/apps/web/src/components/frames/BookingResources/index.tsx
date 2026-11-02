import type { BookingResourcesData, BookingResourcesActions } from "@/modules/types"
import { Alert, Button, Form, Grid, Input, NumberField, Section, Select, Stack } from "@starci/grammar/common"
import { BookingActiveFooter } from "@/components/composites/BookingActiveFooter"
import { BookingAddButton } from "@/components/composites/BookingAddButton"
import { BookingCatalogList } from "@/components/composites/BookingCatalogList"
import { BookingRemoveDialog } from "@/components/composites/BookingRemoveDialog"

type ReadyProps = Omit<BookingResourcesData, "title" | "hint">

type Actions = {
    readonly add: BookingResourcesActions["onAdd"]
    readonly edit: BookingResourcesActions["onEdit"]
    readonly ask: BookingResourcesActions["onAsk"]
    readonly change: BookingResourcesActions["onChange"]
    readonly changeHours: BookingResourcesActions["onChangeHours"]
    readonly save: BookingResourcesActions["onSave"]
    readonly saveHours: BookingResourcesActions["onSaveHours"]
    readonly cancelForm: BookingResourcesActions["onCancelForm"]
    readonly confirmRemove: BookingResourcesActions["onConfirmRemove"]
    readonly cancelRemove: BookingResourcesActions["onCancelRemove"]
}

/** Resolved BookingResources fields and atomic commands; read status remains in its owning workbench. */
type BookingResourcesProps = ReadyProps & {
    readonly isLoading: boolean
    readonly onAdd: BookingResourcesActions["onAdd"]
    readonly onEdit: BookingResourcesActions["onEdit"]
    readonly onAsk: BookingResourcesActions["onAsk"]
    readonly onChange: BookingResourcesActions["onChange"]
    readonly onChangeHours: BookingResourcesActions["onChangeHours"]
    readonly onSave: BookingResourcesActions["onSave"]
    readonly onSaveHours: BookingResourcesActions["onSaveHours"]
    readonly onCancelForm: BookingResourcesActions["onCancelForm"]
    readonly onConfirmRemove: BookingResourcesActions["onConfirmRemove"]
    readonly onCancelRemove: BookingResourcesActions["onCancelRemove"]
}

/** Draws the people and rooms of the shop: the list, the form of the one being edited and its weekly hours. */
export const BookingResources = (props: BookingResourcesProps) => {
    const on = {
        add: props.onAdd,
        edit: props.onEdit,
        ask: props.onAsk,
        change: props.onChange,
        changeHours: props.onChangeHours,
        save: props.onSave,
        saveHours: props.onSaveHours,
        cancelForm: props.onCancelForm,
        confirmRemove: props.onConfirmRemove,
        cancelRemove: props.onCancelRemove,
    }
    return (
        <>
            <BookingCatalogList
                onRemove={on.ask}
                onEdit={on.edit}
                isPending={props.isPending}
                isLoading={props.isLoading}
                {...props.list}
            />
            {props.form === undefined ? (
                <BookingAddButton label={props.addLabel} isLoading={props.isLoading} onPress={on.add} />
            ) : (
                <Stack gap="row">
                    {renderResourceForm(props, on, props.isLoading)}
                    {props.form.canSaveHours ? (
                        <Section title={props.form.hoursHeading} description={props.form.hoursHint} headingLevel={3}>
                            <Grid kind="form" columns={2}>
                                {props.form.hours.map((day) => (
                                    <Input
                                        isLoading={props.isLoading}
                                        key={day.day}
                                        id={`booking-resource-hours-${day.day}`}
                                        name={`hours${day.day}`}
                                        label={day.label}
                                        {...(props.form?.hoursPlaceholder === undefined
                                            ? {}
                                            : { placeholder: props.form.hoursPlaceholder })}
                                        value={day.value}
                                        onValueChange={(value) => on.changeHours(day.day, value)}
                                    />
                                ))}
                            </Grid>
                            <div>
                                <Button
                                    size="sm"
                                    intent="commit"
                                    isPending={props.isPending}
                                    isLoading={props.isLoading}
                                    onPress={on.saveHours}
                                >
                                    {props.form.saveHoursLabel}
                                </Button>
                            </div>
                        </Section>
                    ) : null}
                </Stack>
            )}
            {props.notice === undefined ? null : <Alert tone={props.notice.tone} title={props.notice.text} />}
            {props.removing === undefined ? null : (
                <BookingRemoveDialog {...props.removing} onConfirm={on.confirmRemove} onCancel={on.cancelRemove} />
            )}
        </>
    )
}

/** Draws the Form section of the BookingResources view. */
const renderResourceForm = (p: ReadyProps, on: Actions, isLoading: boolean) => {
    if (p.form === undefined) return null
    return (
        <Form label={p.form.heading} isPending={p.isPending} onSubmit={on.save}>
            <Stack gap="row">
                <Grid kind="form" columns={2}>
                    <Input
                        isLoading={isLoading}
                        id="booking-resource-name"
                        autoFocus
                        name="name"
                        label={p.form.nameLabel}
                        isRequired
                        value={p.form.fields.name}
                        onValueChange={(name) => on.change({ name })}
                    />
                    <Input
                        isLoading={isLoading}
                        id="booking-resource-kind"
                        name="kind"
                        label={p.form.kindLabel}
                        value={p.form.fields.kind}
                        onValueChange={(kind) => on.change({ kind })}
                    />
                    <NumberField
                        isLoading={isLoading}
                        label={p.form.capacityLabel}
                        minValue={1}
                        step={1}
                        value={p.form.fields.capacity}
                        onValueChange={(capacity) => on.change({ capacity })}
                    />
                    {p.form.staffOptions.length > 1 ? (
                        <Select
                            isLoading={isLoading}
                            label={p.form.staffLabel}
                            options={p.form.staffOptions}
                            value={p.form.fields.staffId}
                            onValueChange={(staffId) => on.change({ staffId: staffId ?? "none" })}
                        />
                    ) : null}
                </Grid>
                <BookingActiveFooter
                    isLoading={isLoading}
                    onCancel={on.cancelForm}
                    onToggle={(active) => on.change({ active })}
                    isPending={p.isPending}
                    cancelLabel={p.form.cancelLabel}
                    saveLabel={p.form.saveLabel}
                    isActive={p.form.fields.active}
                    activeLabel={p.form.activeLabel}
                />
            </Stack>
        </Form>
    )
}
