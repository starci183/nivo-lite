import {
    Alert,
    Button,
    Form,
    Heading,
    HorizontalScrollRegion,
    RadioGroup,
    SegmentedControl,
    SurfaceCard,
    Text,
    TextAction,
} from "@starci/grammar/common"
import { PublicBookingContact } from "@/components/branches/PublicBookingContact"
import type { PublicBookingContactProps } from "@/components/branches/PublicBookingContact"
import { FORM_CLASS, ROW_CLASS, STACK_CLASS } from "./classNames"

import type { PublicBookingFormProps } from "./index"

interface PublicBookingAlternativesProps {
    readonly alternatives: NonNullable<PublicBookingFormProps["props"]["done"]>["alternatives"]
    readonly label: string
    readonly onPick: PublicBookingFormProps["on"]["pickAlternative"]
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

type PublicBookingTimesProps = Pick<PublicBookingFormProps["props"], "times" | "labels" | "fields"> &
    Pick<PublicBookingFormProps, "on">

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

/** Draws the customer's side of the booking page: service, day and time, then name and phone. No account, no login. */
export const PublicBookingForm = (props: PublicBookingFormProps) => {
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
                <BookingServiceFields {...props} />

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

                <PublicBookingContact {...contactPropsOf(props)} />

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

/** Renders the BookingServiceFields section. */
const BookingServiceFields = (props: PublicBookingFormProps) => {
    const { props: p, on } = props
    return (
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
    )
}

/** Selects the contact values and update command for the final booking step. */
const contactPropsOf = (props: PublicBookingFormProps): PublicBookingContactProps => ({
    props: { fields: props.props.fields, labels: props.props.labels },
    on: { change: props.on.change },
})
