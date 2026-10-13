import {
    Alert,
    Button,
    Form,
    Heading,
    HorizontalScrollRegion,
    Input,
    NumberField,
    RadioGroup,
    SegmentedControl,
    SurfaceCard,
    Text,
    TextAction,
} from "@starci/grammar/common"
import { FORM_CLASS, HONEYPOT_CLASS, ROW_CLASS, STACK_CLASS } from "./classNames"

/** The fields of the form. */
export interface PublicBookingFieldValues {
    readonly serviceId: string
    readonly date: string
    readonly start: string
    readonly name: string
    readonly phone: string
    readonly email: string
    readonly party: number
    readonly note: string
    readonly website: string
}

/** A nearby free time the visitor can take instead. */
export interface PublicBookingAlternative {
    readonly value: string
    readonly label: string
    readonly date: string
}

/** Props for {@link PublicBookingFormBase}. */
export interface PublicBookingFormBaseProps {
    readonly props: {
        readonly formLabel: string
        readonly fields: PublicBookingFieldValues
        readonly services: ReadonlyArray<{
            readonly value: string
            readonly label: string
            readonly description: string
        }>
        readonly noServicesText: string
        readonly days: ReadonlyArray<{ readonly value: string; readonly label: string }>
        /** Null while the free times load. */
        readonly times: ReadonlyArray<{ readonly value: string; readonly label: string }> | null
        readonly labels: {
            readonly step1: string
            readonly step2: string
            readonly step3: string
            readonly finding: string
            readonly noTimes: string
            readonly pickTime: string
            readonly name: string
            readonly phone: string
            readonly email: string
            readonly party: string
            readonly note: string
            readonly website: string
            readonly submit: string
            readonly footnote: string
            readonly again: string
            readonly alternatives: string
        }
        readonly isBusy: boolean
        /** The result under the form: a success replaces the form, a failure sits above the button. */
        readonly done?: {
            readonly title: string
            readonly message: string
            readonly alternatives: ReadonlyArray<PublicBookingAlternative>
        }
        readonly failure?: { readonly message: string; readonly alternatives: ReadonlyArray<PublicBookingAlternative> }
    }
    readonly on: {
        readonly change: (patch: Partial<PublicBookingFieldValues>) => void
        readonly submit: () => void
        readonly again: () => void
        readonly pickAlternative: (start: string, date: string) => void
    }
}

interface PublicBookingAlternativesProps {
    readonly alternatives: ReadonlyArray<PublicBookingAlternative>
    readonly label: string
    readonly onPick: PublicBookingFormBaseProps["on"]["pickAlternative"]
}

const PublicBookingAlternatives = ({ alternatives, label, onPick }: PublicBookingAlternativesProps) => {
    if (alternatives.length === 0) return null
    return (
        <>
            <Text size="sm" tone="muted">
                {label}
            </Text>
            <div className={ROW_CLASS}>
                {alternatives.map((alternative) => (
                    <Button
                        key={alternative.value}
                        size="sm"
                        variant="outline"
                        onPress={() => onPick(alternative.value, alternative.date)}
                    >
                        {alternative.label}
                    </Button>
                ))}
            </div>
        </>
    )
}

type PublicBookingTimesProps = Pick<PublicBookingFormBaseProps["props"], "times" | "labels" | "fields"> &
    Pick<PublicBookingFormBaseProps, "on">

const PublicBookingTimes = ({ times, labels, fields, on }: PublicBookingTimesProps) => {
    if (times === null || times.length === 0) {
        return (
            <Text size="sm" tone="muted" live="polite">
                {times === null ? labels.finding : labels.noTimes}
            </Text>
        )
    }
    return (
        <RadioGroup
            label={labels.pickTime}
            name="start"
            variant="secondary"
            orientation="horizontal"
            options={times.map((time) => ({ value: time.value, label: time.label }))}
            value={fields.start === "" ? null : fields.start}
            onValueChange={(start) => on.change({ start })}
        />
    )
}

/** Retains the bot trap's native tab order while Common Input has no tabIndex prop. */
const keepHoneypotOutOfTabOrder = (node: HTMLDivElement | null) => {
    node?.querySelector("input")?.setAttribute("tabindex", "-1")
}

/** Draws the customer's side of the booking page: service, day and time, then name and phone. No account, no login. */
export const PublicBookingFormBase = (props: PublicBookingFormBaseProps) => {
    const { props: p, on } = props
    if (p.done !== undefined) {
        return (
            <SurfaceCard ariaLabel={p.done.title}>
                <div className={STACK_CLASS}>
                    <Heading level={2}>{p.done.title}</Heading>
                    <Text live="polite">{p.done.message}</Text>
                    <PublicBookingAlternatives
                        alternatives={p.done.alternatives}
                        label={p.labels.alternatives}
                        onPick={on.pickAlternative}
                    />
                    <div className={ROW_CLASS}>
                        <TextAction size="sm" onPress={on.again}>
                            {p.labels.again}
                        </TextAction>
                    </div>
                </div>
            </SurfaceCard>
        )
    }
    const { start, name, phone, serviceId } = p.fields
    const ready = start !== "" && name.trim() !== "" && phone.trim() !== "" && serviceId !== ""
    return (
        <Form label={p.formLabel} isPending={p.isBusy} validationBehavior="aria" onSubmit={on.submit}>
            <div className={FORM_CLASS}>
                <SurfaceCard ariaLabel={p.labels.step1}>
                    {p.services.length === 0 ? (
                        <div className={STACK_CLASS}>
                            <Heading level={2}>{p.labels.step1}</Heading>
                            <Text size="sm" tone="muted">
                                {p.noServicesText}
                            </Text>
                        </div>
                    ) : (
                        <RadioGroup
                            label={p.labels.step1}
                            name="service"
                            variant="secondary"
                            options={p.services.map((service) => ({
                                value: service.value,
                                label: service.label,
                                description: service.description,
                            }))}
                            value={p.fields.serviceId}
                            onValueChange={(serviceId) => on.change({ serviceId })}
                        />
                    )}
                </SurfaceCard>

                <SurfaceCard ariaLabel={p.labels.step2}>
                    <div className={STACK_CLASS}>
                        <HorizontalScrollRegion overflow="needed" isFocusable={false}>
                            <SegmentedControl
                                label={p.labels.step2}
                                options={p.days.map((day) => ({ value: day.value, label: day.label }))}
                                value={p.fields.date}
                                onValueChange={(date) => on.change({ date })}
                            />
                        </HorizontalScrollRegion>
                        <PublicBookingTimes times={p.times} labels={p.labels} fields={p.fields} on={on} />
                    </div>
                </SurfaceCard>

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
                            onValueChange={(party) =>
                                on.change({ party: Number.isFinite(party) ? Math.max(1, party) : 1 })
                            }
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

                {p.failure === undefined ? null : (
                    <div className={STACK_CLASS}>
                        <Alert tone="negative" title={p.failure.message} />
                        <PublicBookingAlternatives
                            alternatives={p.failure.alternatives}
                            label={p.labels.alternatives}
                            onPick={on.pickAlternative}
                        />
                    </div>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    width="fill"
                    isPending={p.isBusy}
                    isDisabled={p.isBusy || !ready}
                >
                    {p.labels.submit}
                </Button>
                <Text size="xs" tone="muted">
                    {p.labels.footnote}
                </Text>
            </div>
        </Form>
    )
}
