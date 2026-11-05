import {
    Alert,
    Button,
    Form,
    Heading,
    HorizontalScrollRegion,
    RadioGroup,
    ChoiceChips,
    SurfaceCard,
    Text,
    TextAction,
    Cluster,
    Stack,
} from "@starci/grammar/common"
import { PublicBookingContact } from "@/components/branches/PublicBookingContact"
import type { PublicBookingContactProps } from "@/components/branches/PublicBookingContact"

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
            <Cluster gap="inline">
                {alternatives.map((alternative) => (
                    <Button
                        key={alternative.value}
                        size="sm"
                        intent="neutral"
                        onPress={() => onPick(alternative.value, alternative.date)}
                    >
                        {alternative.label}
                    </Button>
                ))}
            </Cluster>
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
                <Stack gap="row">
                    <Heading level={2}>{p.done.title}</Heading>
                    <Text live="polite">{p.done.message}</Text>
                    <PublicBookingAlternatives
                        alternatives={p.done.alternatives}
                        label={p.labels.alternatives}
                        onPick={on.pickAlternative}
                    />
                    <Cluster gap="inline">
                        <TextAction size="sm" onPress={on.again}>
                            {p.labels.again}
                        </TextAction>
                    </Cluster>
                </Stack>
            </SurfaceCard>
        )
    }
    const { start, name, phone, serviceId } = p.fields
    const ready = start !== "" && name.trim() !== "" && phone.trim() !== "" && serviceId !== ""
    return (
        <Form label={p.formLabel} isPending={p.isBusy} validationBehavior="aria" onSubmit={on.submit}>
            <Stack gap="section">
                <BookingServiceFields {...props} />

                <SurfaceCard ariaLabel={p.labels.step2}>
                    <Stack gap="row">
                        <HorizontalScrollRegion overflow="needed" isFocusable={false}>
                            <ChoiceChips
                                label={p.labels.step2}
                                empty={p.labels.step2}
                                options={p.days.map((day) => ({ value: day.value, label: day.label }))}
                                value={p.fields.date}
                                onValueChange={(date) => on.change({ date })}
                            />
                        </HorizontalScrollRegion>
                        <PublicBookingTimes times={p.times} labels={p.labels} fields={p.fields} on={on} />
                    </Stack>
                </SurfaceCard>

                <PublicBookingContact {...contactPropsOf(props)} />

                {p.refusal === undefined ? null : (
                    <Stack gap="row">
                        <Alert tone="negative" title={p.refusal.message} />
                        <PublicBookingAlternatives
                            alternatives={p.refusal.alternatives}
                            label={p.labels.alternatives}
                            onPick={on.pickAlternative}
                        />
                    </Stack>
                )}

                <Button type="submit" intent="commit" width="fill" isPending={p.isBusy} isDisabled={p.isBusy || !ready}>
                    {p.labels.submit}
                </Button>
                <Text size="xs" tone="muted">
                    {p.labels.footnote}
                </Text>
            </Stack>
        </Form>
    )
}

/** Renders the BookingServiceFields section. */
const BookingServiceFields = (props: PublicBookingFormProps) => {
    const { props: p, on } = props
    return (
        <SurfaceCard ariaLabel={p.labels.step1}>
            {p.services.length === 0 ? (
                <Stack gap="row">
                    <Heading level={2}>{p.labels.step1}</Heading>
                    <Text size="sm" tone="muted">
                        {p.noServicesText}
                    </Text>
                </Stack>
            ) : (
                <RadioGroup
                    label={p.labels.step1}
                    name="service"
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
