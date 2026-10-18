import { Heading, Input, NumberField, SurfaceCard } from "@starci/grammar/common"
import { HONEYPOT_CLASS, STACK_CLASS } from "./classNames"

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
        <SurfaceCard ariaLabel={p.labels.step3}>
            <div className={STACK_CLASS}>
                <Heading level={2}>{p.labels.step3}</Heading>
                <Input
                    id="booking-public-name"
                    name="name"
                    label={p.labels.name}
                    variant="secondary"
                    isRequired
                    value={p.fields.name}
                    onValueChange={(name) => on.change({ name })}
                />
                <Input
                    id="booking-public-phone"
                    name="phone"
                    kind="tel"
                    label={p.labels.phone}
                    variant="secondary"
                    isRequired
                    value={p.fields.phone}
                    onValueChange={(phone) => on.change({ phone })}
                />
                <Input
                    id="booking-public-email"
                    name="email"
                    kind="email"
                    label={p.labels.email}
                    variant="secondary"
                    value={p.fields.email}
                    onValueChange={(email) => on.change({ email })}
                />
                <NumberField
                    label={p.labels.party}
                    variant="secondary"
                    minValue={1}
                    maxValue={20}
                    step={1}
                    value={p.fields.party}
                    onValueChange={(party) => on.change({ party: Number.isFinite(party) ? Math.max(1, party) : 1 })}
                />
                <Input
                    id="booking-public-note"
                    name="note"
                    label={p.labels.note}
                    variant="secondary"
                    value={p.fields.note}
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
            </div>
        </SurfaceCard>
    )
}

/** Contact fields and resolved labels. */
interface PublicBookingContactView {
    readonly fields: PublicBookingContactValues
    readonly labels: Readonly<Record<"step3" | "name" | "phone" | "email" | "party" | "note" | "website", string>>
}

/** Contact editing command. */
interface PublicBookingContactActions {
    readonly change: (patch: Partial<PublicBookingContactValues>) => void
}
