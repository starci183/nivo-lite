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

/** Draws the customer's side of the booking page: service, day and time, then name and phone. No account, no login. */
export const PublicBookingFormBase = (props: PublicBookingFormBaseProps) => {
    const { props: p, on } = props
    if (p.done !== undefined) {
        return (
            <SurfaceCard ariaLabel={p.done.title}>
                <div className={STACK_CLASS}>
                    <Heading level={2}>{p.done.title}</Heading>
                    <Text live="polite">{p.done.message}</Text>
                    {p.done.alternatives.length === 0 ? null : (
                        <>
                            <Text size="sm" tone="muted">
                                {p.labels.alternatives}
                            </Text>
                            <div className={ROW_CLASS}>
                                {p.done.alternatives.map((alternative) => (
                                    <Button
                                        key={alternative.value}
                                        size="sm"
                                        variant="outline"
                                        onPress={() => on.pickAlternative(alternative.value, alternative.date)}
                                    >
                                        {alternative.label}
                                    </Button>
                                ))}
                            </div>
                        </>
                    )}
                    <div className={ROW_CLASS}>
                        <TextAction size="sm" onPress={on.again}>
                            {p.labels.again}
                        </TextAction>
                    </div>
                </div>
            </SurfaceCard>
        )
    }
    const ready =
        p.fields.start !== "" &&
        p.fields.name.trim() !== "" &&
        p.fields.phone.trim() !== "" &&
        p.fields.serviceId !== ""
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
                        {p.times === null ? (
                            <Text size="sm" tone="muted" live="polite">
                                {p.labels.finding}
                            </Text>
                        ) : p.times.length === 0 ? (
                            <Text size="sm" tone="muted" live="polite">
                                {p.labels.noTimes}
                            </Text>
                        ) : (
                            <RadioGroup
                                label={p.labels.pickTime}
                                name="start"
                                variant="secondary"
                                orientation="horizontal"
                                options={p.times.map((time) => ({ value: time.value, label: time.label }))}
                                value={p.fields.start === "" ? null : p.fields.start}
                                onValueChange={(start) => on.change({ start })}
                            />
                        )}
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
                        {/* grammar gap: no Common honeypot field; the bot trap stays a raw, visually hidden input. */}
                        <div aria-hidden className={HONEYPOT_CLASS}>
                            <label>
                                {p.labels.website}
                                <input
                                    tabIndex={-1}
                                    autoComplete="off"
                                    value={p.fields.website}
                                    onChange={(event) => on.change({ website: event.target.value })}
                                />
                            </label>
                        </div>
                    </div>
                </SurfaceCard>

                {p.failure === undefined ? null : (
                    <div className={STACK_CLASS}>
                        <Alert tone="negative" title={p.failure.message} />
                        {p.failure.alternatives.length === 0 ? null : (
                            <>
                                <Text size="sm" tone="muted">
                                    {p.labels.alternatives}
                                </Text>
                                <div className={ROW_CLASS}>
                                    {p.failure.alternatives.map((alternative) => (
                                        <Button
                                            key={alternative.value}
                                            size="sm"
                                            variant="outline"
                                            onPress={() => on.pickAlternative(alternative.value, alternative.date)}
                                        >
                                            {alternative.label}
                                        </Button>
                                    ))}
                                </div>
                            </>
                        )}
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
