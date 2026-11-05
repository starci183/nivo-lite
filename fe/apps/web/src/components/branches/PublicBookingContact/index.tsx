import { Grid, Input, NumberField } from "@starci/grammar/common"

import { HONEYPOT_CLASS } from "./classNames"

/** Values collected by the booking contact step. */
interface PublicBookingContactValues {
    readonly name: string
    readonly phone: string
    readonly email: string
    readonly party: number
    readonly note: string
    readonly website: string
}

/** Labels, contact values and updates for the final booking step. */
export interface PublicBookingContactProps {
    readonly props: PublicBookingContactView
    readonly on: PublicBookingContactActions
}

/** Retains the bot trap's native tab order while Common Input has no tabIndex prop. */
const keepHoneypotOutOfTabOrder = (node: HTMLDivElement | null) => {
    node?.querySelector("input")?.setAttribute("tabindex", "-1")
}

/** Renders the PublicBookingContact section. */
export const PublicBookingContact = (props: PublicBookingContactProps) => {
    const { props: p, on } = props
    return (
        <Grid kind="form">
            <Input
                id="booking-public-name"
                name="name"
                label={p.labels.name}
                isRequired
                value={p.fields.name}
                isLoading={p.isLoading}
                onValueChange={(name) => on.change({ name })}
            />
            <Input
                id="booking-public-phone"
                name="phone"
                kind="tel"
                label={p.labels.phone}
                isRequired
                value={p.fields.phone}
                isLoading={p.isLoading}
                onValueChange={(phone) => on.change({ phone })}
            />
            <Input
                id="booking-public-email"
                name="email"
                kind="email"
                label={p.labels.email}
                value={p.fields.email}
                isLoading={p.isLoading}
                onValueChange={(email) => on.change({ email })}
            />
            <NumberField
                label={p.labels.party}
                minValue={1}
                maxValue={20}
                step={1}
                value={p.fields.party}
                isLoading={p.isLoading}
                onValueChange={(party) => on.change({ party: Number.isFinite(party) ? Math.max(1, party) : 1 })}
            />
            <Input
                id="booking-public-note"
                name="note"
                span="full"
                label={p.labels.note}
                placeholder={p.labels.notePlaceholder}
                value={p.fields.note}
                isLoading={p.isLoading}
                onValueChange={(note) => on.change({ note })}
            />
            <div aria-hidden className={HONEYPOT_CLASS} ref={keepHoneypotOutOfTabOrder}>
                <Input
                    id="booking-public-website"
                    name=""
                    label={p.labels.website}
                    kind="text"
                    value={p.fields.website}
                    onValueChange={(website) => on.change({ website })}
                />
            </div>
        </Grid>
    )
}

/** Contact fields and resolved labels. */
interface PublicBookingContactView {
    readonly fields: PublicBookingContactValues
    readonly isLoading: boolean
    readonly labels: Readonly<
        Record<"name" | "phone" | "email" | "party" | "note" | "notePlaceholder" | "website", string>
    >
}

/** Contact editing command. */
interface PublicBookingContactActions {
    readonly change: (patch: Partial<PublicBookingContactValues>) => void
}
