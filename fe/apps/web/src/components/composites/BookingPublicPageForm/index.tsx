import type { BookingPublicPageData, BookingPublicPageActions } from "@/modules/types"
import { Checkbox, Form, Input, Link, Text, Stack } from "@starci/grammar/common"
import { BookingSaveLine } from "@/components/branches/BookingSaveLine"

type ReadyProps = Omit<BookingPublicPageData, "hint">

/** Resolved BookingPublicPageForm fields and atomic commands; read status remains in its owning workbench. */
type BookingPublicPageFormProps = ReadyProps & {
    readonly isLoading: boolean
    readonly onToggleEnabled: BookingPublicPageActions["onToggleEnabled"]
    readonly onChangeSlug: BookingPublicPageActions["onChangeSlug"]
    readonly onChangeNote: BookingPublicPageActions["onChangeNote"]
    readonly onSave: BookingPublicPageActions["onSave"]
}

/** Draws the form that switches the public booking page on and names its address and note. */
export const BookingPublicPageForm = (props: BookingPublicPageFormProps) => {
    const on = {
        toggleEnabled: props.onToggleEnabled,
        changeSlug: props.onChangeSlug,
        changeNote: props.onChangeNote,
        save: props.onSave,
    }
    return (
        <Form label={props.title} isPending={props.isPending} onSubmit={on.save}>
            <Stack gap="row">
                <Checkbox
                    isLoading={props.isLoading}
                    label={props.enabledLabel}
                    isSelected={props.enabled}
                    onSelectedChange={on.toggleEnabled}
                />
                <Input
                    isLoading={props.isLoading}
                    id="booking-public-slug"
                    name="slug"
                    label={props.slugLabel}
                    placeholder={props.slugPlaceholder}
                    value={props.slug}
                    onValueChange={on.changeSlug}
                />
                <Input
                    isLoading={props.isLoading}
                    id="booking-public-page-note"
                    name="note"
                    label={props.noteLabel}
                    placeholder={props.notePlaceholder}
                    value={props.note}
                    onValueChange={on.changeNote}
                />
                {props.link === undefined ? null : (
                    <Text size="sm">
                        {props.link.label}{" "}
                        <Link href={props.link.href} kind="external" externalHint={props.link.hint}>
                            {props.link.href}
                        </Link>
                    </Text>
                )}
                <BookingSaveLine isLoading={props.isLoading} label={props.saveLabel} isPending={props.isPending} />
            </Stack>
        </Form>
    )
}
