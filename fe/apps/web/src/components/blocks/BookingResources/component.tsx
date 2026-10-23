import type { Dispatch, SetStateAction, useTransition } from "react"
import type { useFormatter, useTranslations } from "next-intl"
import type { useBookingBoard } from "@/hooks/bookingBoard"
import type { parseWeek, useBookingSetupSave } from "@/hooks/bookingSetup"
import type {
    useMutateSaveBookingResourceSwr,
    useMutateSaveBookingHoursSwr,
    useMutateRemoveBookingResourceSwr,
} from "@/hooks/swr"
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
                    {renderResourceForm(p, on)}
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
                                        {...(p.form?.hoursPlaceholder === undefined
                                            ? {}
                                            : { placeholder: p.form.hoursPlaceholder })}
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

/** Draws the Form section of the BookingResources view. */
const renderResourceForm = (p: BookingResourcesBaseProps["props"], on: BookingResourcesBaseProps["on"]) => {
    if (p.form === undefined) return null
    return (
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
    )
}

/** The form being edited: a new resource has no id and no hours yet. */
export interface Draft {
    readonly id: string | null
    readonly fields: ResourceFields
    readonly lines: ReadonlyArray<string>
}

/** Feedback from a resource save. */
export interface ResourceNotice {
    readonly ok: boolean
    readonly text: string
}

/** Inputs for composing resource form callbacks and formatted state. */
interface ResourceContext {
    readonly board: ReturnType<typeof useBookingBoard>["board"]
    readonly removeId: string | null
    readonly format: ReturnType<typeof useFormatter>
    readonly draft: Draft | null
    readonly startTransition: ReturnType<typeof useTransition>[1]
    readonly persist: ReturnType<typeof useBookingSetupSave>
    readonly saveResource: ReturnType<typeof useMutateSaveBookingResourceSwr>
    readonly setDraft: Dispatch<SetStateAction<Draft | null>>
    readonly setNotice: Dispatch<SetStateAction<ResourceNotice | null>>
    readonly t: ReturnType<typeof useTranslations<"workbenchBooking">>
    readonly saveResourceHours: ReturnType<typeof useMutateSaveBookingHoursSwr>
    readonly isPending: boolean
    readonly notice: ResourceNotice | null
    readonly setRemoveId: Dispatch<SetStateAction<string | null>>
    readonly removeResource: ReturnType<typeof useMutateRemoveBookingResourceSwr>
    readonly parseWeek: typeof parseWeek
}

/** Composes resource form callbacks from the connected inputs. */
export const buildBookingResourcesState = (context: ResourceContext) => {
    const {
        board,
        removeId,
        format,
        draft,
        startTransition,
        persist,
        saveResource,
        setDraft,
        setNotice,
        t,
        saveResourceHours,
        parseWeek,
    } = context
    const removing = board.resources.find((resource) => resource.id === removeId)
    const weekdayName = (day: number) =>
        format.dateTime(new Date(Date.UTC(2024, 0, day)), { weekday: "short", timeZone: "UTC" })
    const save = () => {
        if (draft === null) return
        const { fields } = draft
        startTransition(async () => {
            const answer = await persist(() =>
                saveResource.trigger({
                    id: draft.id,
                    name: fields.name,
                    kind: fields.kind,
                    capacity: fields.capacity,
                    active: fields.active,
                    staffId: fields.staffId === "none" ? null : fields.staffId,
                }),
            )
            if (answer === undefined) return
            setDraft(null)
        })
    }
    const saveHours = () => {
        if (draft?.id === undefined || draft.id === null) return
        const week = parseWeek(draft.lines)
        if ("badWeekday" in week)
            return setNotice({ ok: false, text: t("hoursInvalid", { day: weekdayName(week.badWeekday) }) })
        const resourceId = draft.id
        startTransition(async () => {
            const answer = await persist(() => saveResourceHours.trigger({ resourceId, rows: week.rows }))
            if (answer === undefined) return
        })
    }
    return { ...context, weekdayName, removing, save, saveHours }
}
