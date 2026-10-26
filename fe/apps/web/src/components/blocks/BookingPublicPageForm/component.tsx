import { Checkbox, Form, Input, Link, Text } from "@starci/grammar/common"
import { BookingSaveLine } from "@/components/composites/BookingSaveLine"
import { BookingSetupSection } from "@/components/composites/BookingSetupSection"
import { STACK_CLASS } from "./classNames"

/** Props for {@link BookingPublicPageFormBase}. */
export interface BookingPublicPageFormBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly enabledLabel: string
        readonly enabled: boolean
        readonly slugLabel: string
        readonly slug: string
        readonly slugPlaceholder: string
        readonly noteLabel: string
        readonly note: string
        readonly notePlaceholder: string
        readonly link?: { readonly label: string; readonly href: string; readonly hint: string }
        readonly saveLabel: string
        readonly isPending: boolean
        readonly notice?: { readonly tone: "affirmative" | "negative"; readonly text: string }
    }
    readonly on: {
        readonly toggleEnabled: (value: boolean) => void
        readonly changeSlug: (value: string) => void
        readonly changeNote: (value: string) => void
        readonly save: () => void
    }
}

/** Draws the form that switches the public booking page on and names its address and note. */
export const BookingPublicPageFormBase = (props: BookingPublicPageFormBaseProps) => {
    const { props: p, on } = props
    return (
        <BookingSetupSection title={p.title} hint={p.hint}>
            <Form label={p.title} isPending={p.isPending} onSubmit={on.save}>
                <div className={STACK_CLASS}>
                    <Checkbox label={p.enabledLabel} isSelected={p.enabled} onSelectedChange={on.toggleEnabled} />
                    <Input
                        id="booking-public-slug"
                        name="slug"
                        label={p.slugLabel}
                        placeholder={p.slugPlaceholder}
                        value={p.slug}
                        onValueChange={on.changeSlug}
                    />
                    <Input
                        id="booking-public-page-note"
                        name="note"
                        label={p.noteLabel}
                        placeholder={p.notePlaceholder}
                        value={p.note}
                        onValueChange={on.changeNote}
                    />
                    {p.link === undefined ? null : (
                        <Text size="sm">
                            {p.link.label}{" "}
                            <Link href={p.link.href} kind="external" externalHint={p.link.hint}>
                                {p.link.href}
                            </Link>
                        </Text>
                    )}
                    <BookingSaveLine
                        label={p.saveLabel}
                        isPending={p.isPending}
                        {...(p.notice === undefined ? {} : { notice: p.notice })}
                    />
                </div>
            </Form>
        </BookingSetupSection>
    )
}
