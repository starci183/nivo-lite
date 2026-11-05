import {
    Alert,
    Button,
    Calendar,
    ChoiceChips,
    Cluster,
    Form,
    RadioGroup,
    Stack,
    SurfaceCard,
    Text,
    TextAction,
} from "@starci/grammar/common"
import { parseDate } from "@internationalized/date"
import type { Band } from "@starci/grammar/common"
import { PublicBookingContact } from "@/components/branches/PublicBookingContact"
import type { PublicBookingContactProps } from "@/components/branches/PublicBookingContact"

import type { PublicBookingFormProps } from "./index"

type Alternatives = NonNullable<PublicBookingFormProps["props"]["done"]>["alternatives"]

interface PublicBookingAlternativesProps {
    readonly alternatives: Alternatives
    readonly label: string
    readonly onPick: PublicBookingFormProps["on"]["pickAlternative"]
}

/** The nearest free times the shop offers instead, one press to take one. */
const PublicBookingAlternatives = ({ alternatives, label, onPick }: PublicBookingAlternativesProps) => {
    if (alternatives.length === 0) return null
    return (
        <Stack gap="row">
            <Text size="sm" tone="muted">
                {label}
            </Text>
            <Cluster gap="inline">
                {alternatives.map((alternative) => (
                    <Button
                        key={alternative.value}
                        intent="neutral"
                        onPress={() => onPick(alternative.value, alternative.date)}
                    >
                        {alternative.label}
                    </Button>
                ))}
            </Cluster>
        </Stack>
    )
}

/** Unseen text that gives a skeleton line the width of a real one. */
const GHOST = "M".repeat(16)

/** The form of the skeleton: every field blank, the times unread, so the card holds no data while the shop loads. */
const loadingFormOf = (form: PublicBookingFormProps["props"]): PublicBookingFormProps["props"] => ({
    ...form,
    fields: { ...form.fields, serviceId: "", start: "", name: "", phone: "", email: "", note: "", party: 1 },
    services: ["a", "b", "c"].map((value) => ({ value, label: GHOST, description: GHOST })),
    times: null,
    summary: "",
    need: "",
})

/** The contact fields' props out of the form's. */
const contactPropsOf = (props: PublicBookingFormProps): PublicBookingContactProps => ({
    props: { fields: props.props.fields, labels: props.props.labels, isLoading: props.isLoading === true },
    on: { change: props.on.change },
})

/** The services as one choice, or the line that the shop takes no bookings here yet. */
const ServiceChoice = (props: PublicBookingFormProps) => {
    const { props: p, on } = props
    if (p.services.length === 0 && props.isLoading !== true) {
        return (
            <Text size="sm" tone="muted">
                {p.noServicesText}
            </Text>
        )
    }
    return (
        <RadioGroup
            label={p.labels.step1}
            isLabelHidden
            appearance="rows"
            name="service"
            isLoading={props.isLoading === true}
            options={p.services.map((service) => ({
                value: service.value,
                label: service.label,
                description: service.description,
            }))}
            value={p.fields.serviceId === "" ? null : p.fields.serviceId}
            onValueChange={(serviceId) => on.change({ serviceId })}
        />
    )
}

/** Band 1: the services, one choice each with its duration and price. */
const serviceBand = (props: PublicBookingFormProps): Band => ({
    kind: "body",
    label: props.props.labels.step1,
    children: <ServiceChoice {...props} />,
})

/** Band 2: the day row, then the free times of that day as pills; a day with none says so. */
const timeBand = (props: PublicBookingFormProps): Band => {
    const { props: p, on } = props
    const first = p.days[0]
    const last = p.days.at(-1)
    return {
        kind: "body",
        label: p.labels.step2,
        children: (
            <Stack gap="row">
                <Calendar
                    label={p.labels.step2}
                    width="fill"
                    locale={p.calendarLocale}
                    isLoading={props.isLoading === true}
                    previousLabel={p.labels.previousMonth}
                    nextLabel={p.labels.nextMonth}
                    value={p.fields.date === "" ? null : parseDate(p.fields.date)}
                    {...(first === undefined ? {} : { minValue: parseDate(first.value) })}
                    {...(last === undefined ? {} : { maxValue: parseDate(last.value) })}
                    onChange={(date) => on.change({ date: date.toString() })}
                />
                <ChoiceChips
                    label={p.labels.pickTime}
                    isLabelHidden
                    isLoading={props.isLoading === true || p.times === null}
                    options={(p.times ?? []).map((time) => ({ value: time.value, label: time.label }))}
                    {...(p.fields.start === "" ? {} : { value: p.fields.start })}
                    onValueChange={(start) => on.change({ start })}
                    empty={<Text tone="muted">{p.labels.noTimes}</Text>}
                />
            </Stack>
        ),
    }
}

/** The last band: the choice in one line, what is missing or what the shop refused, and the one primary command. */
const sendBand = (props: PublicBookingFormProps): Band => {
    const { props: p, on } = props
    return {
        kind: "body",
        children: (
            <Stack gap="row">
                {p.refusal === undefined ? null : (
                    <>
                        <Alert tone="negative" title={p.refusal.message} />
                        <PublicBookingAlternatives
                            alternatives={p.refusal.alternatives}
                            label={p.labels.alternatives}
                            onPick={on.pickAlternative}
                        />
                    </>
                )}
                <Cluster gap="row" justify="between">
                    <Text size="sm" tone={p.need === "" ? "muted" : "default"} live="polite">
                        {p.need === "" ? p.summary : p.need}
                    </Text>
                    <Button type="submit" intent="commit" width="fill-narrow" isPending={p.isBusy}>
                        {p.labels.submit}
                    </Button>
                </Cluster>
                <Text size="xs" tone="muted">
                    {p.labels.footnote}
                </Text>
            </Stack>
        ),
    }
}

/** Draws the customer's side of the booking page: one card of bands (service, day and time, contact, send). No account, no login. */
export const PublicBookingForm = (props: PublicBookingFormProps) => (
    <PublicBookingFormBody {...props} props={props.isLoading === true ? loadingFormOf(props.props) : props.props} />
)

/** The form's bands from props that are already the ready form or the skeleton's blank one. */
const PublicBookingFormBody = (props: PublicBookingFormProps) => {
    const { props: p, on } = props
    if (p.done !== undefined) {
        return (
            <SurfaceCard ariaLabel={p.done.title}>
                <Stack gap="row">
                    <Alert tone="affirmative" title={p.done.title} description={p.done.message} />
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
    return (
        <Form label={p.formLabel} isPending={p.isBusy} validationBehavior="aria" onSubmit={on.submit}>
            <SurfaceCard
                kind="bands"
                ariaLabel={p.formLabel}
                isLoading={props.isLoading === true}
                bands={[
                    serviceBand(props),
                    timeBand(props),
                    {
                        kind: "body",
                        label: p.labels.step3,
                        children: <PublicBookingContact {...contactPropsOf(props)} />,
                    },
                    sendBand(props),
                ]}
            />
        </Form>
    )
}
