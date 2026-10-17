import { Alert, Button, Form, NumberField, SurfaceCard, Text, TextAction, Textarea } from "@starci/grammar/common"
import { InboxSelectField } from "@/components/composites/InboxSelectField"
import type { InboxSelectOption } from "@/components/composites/InboxSelectField"
import { InboxTextField } from "@/components/composites/InboxTextField"
import {
    EVENT_ID_INPUT_CLASS,
    EVENT_ID_ROW_CLASS,
    FORM_GRID_CLASS,
    FORM_WIDE_CLASS,
    PRESETS_CLASS,
    RESULT_LINKS_CLASS,
    STACK_CLASS,
    SUBMIT_ROW_CLASS,
} from "./classNames"

/** What the form holds. */
export interface SimulatorValues {
    readonly channel: string
    readonly kind: string
    readonly name: string
    readonly contact: string
    readonly body: string
    readonly amount: number
    readonly reference: string
    readonly items: string
    readonly eventId: string
}

/** The outcome of the last send, in words. */
export interface SimulatorResult {
    readonly title: string
    readonly tone: "affirmative" | "cautionary"
    readonly lines: ReadonlyArray<string>
    readonly leadHref: string | null
}

/** Props for {@link InboxSimulatorBase}. */
export interface InboxSimulatorBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly presetsLabel: string
        readonly presets: ReadonlyArray<InboxSelectOption>
        readonly labels: Readonly<
            Record<
                | "channel"
                | "kind"
                | "name"
                | "nameHint"
                | "contact"
                | "body"
                | "items"
                | "amount"
                | "reference"
                | "eventId"
                | "eventIdHint"
                | "eventIdNew"
                | "submit"
                | "failTitle"
                | "resultLead"
                | "resultOffice",
                string
            >
        >
        readonly channels: ReadonlyArray<InboxSelectOption>
        readonly kinds: ReadonlyArray<InboxSelectOption>
        readonly values: SimulatorValues
        readonly showItems: boolean
        readonly errors: Readonly<Partial<Record<keyof SimulatorValues, string | undefined>>>
        readonly failure: string | undefined
        readonly result: SimulatorResult | undefined
        /** Where the owner sees what became of the input. */
        readonly officeHref: string
        readonly isPending: boolean
    }
    readonly on: {
        readonly preset: (id: string) => void
        readonly change: (field: keyof SimulatorValues, value: string | number) => void
        readonly newEventId: () => void
        readonly submit: () => void
    }
}

/** Inbound simulator: a labelled form plus one-click presets that only fill it. One primary action sends it into NIVO. */
export const InboxSimulatorBase = (props: InboxSimulatorBaseProps) => {
    const view = props.props
    const on = props.on
    const field = { isPending: view.isPending }
    return (
        <SurfaceCard label={view.title} headingLevel={2}>
            <div className={STACK_CLASS}>
                <Text size="sm" tone="muted">
                    {view.description}
                </Text>
                <Text size="sm" weight="medium">
                    {view.presetsLabel}
                </Text>
                <div className={PRESETS_CLASS}>
                    {view.presets.map((preset) => (
                        <Button
                            key={preset.id}
                            variant="outline"
                            isDisabled={view.isPending}
                            onPress={() => on.preset(preset.id)}
                        >
                            {preset.label}
                        </Button>
                    ))}
                </div>
                <Form label={view.title} onSubmit={on.submit} isPending={view.isPending}>
                    <div className={FORM_GRID_CLASS}>
                        <InboxContactFields {...props} />
                        <InboxMessageFields {...props} />
                        <div className={EVENT_ID_ROW_CLASS}>
                            <div className={EVENT_ID_INPUT_CLASS}>
                                <InboxTextField
                                    {...field}
                                    id="sim-event-id"
                                    name="event_id"
                                    label={view.labels.eventId}
                                    hint={view.labels.eventIdHint}
                                    value={view.values.eventId}
                                    error={view.errors.eventId}
                                    onChange={(value) => on.change("eventId", value)}
                                />
                            </div>
                            <Button variant="outline" isDisabled={view.isPending} onPress={on.newEventId}>
                                {view.labels.eventIdNew}
                            </Button>
                        </div>
                        {view.failure === undefined ? null : (
                            <div className={FORM_WIDE_CLASS}>
                                <Alert title={view.labels.failTitle} description={view.failure} tone="negative" />
                            </div>
                        )}
                        {view.result === undefined ? null : renderSimulatorResult({ view })}
                        <div className={SUBMIT_ROW_CLASS}>
                            <Button variant="primary" type="submit" isPending={view.isPending}>
                                {view.labels.submit}
                            </Button>
                        </div>
                    </div>
                </Form>
            </div>
        </SurfaceCard>
    )
}

/** Sender identity and inbound message channel fields. */
const InboxContactFields = (props: InboxSimulatorBaseProps) => {
    const view = props.props
    const on = props.on
    const field = { isPending: view.isPending }
    return (
        <>
            <InboxSelectField
                {...field}
                name="channel"
                label={view.labels.channel}
                options={view.channels}
                value={view.values.channel}
                error={view.errors.channel}
                onChange={(value) => on.change("channel", value)}
            />
            <InboxSelectField
                {...field}
                name="kind"
                label={view.labels.kind}
                options={view.kinds}
                value={view.values.kind}
                error={view.errors.kind}
                onChange={(value) => on.change("kind", value)}
            />
            <InboxTextField
                {...field}
                id="sim-name"
                name="sender_name"
                label={view.labels.name}
                hint={view.labels.nameHint}
                isRequired
                value={view.values.name}
                error={view.errors.name}
                onChange={(value) => on.change("name", value)}
            />
            <InboxTextField
                {...field}
                id="sim-contact"
                name="sender_contact"
                label={view.labels.contact}
                value={view.values.contact}
                error={view.errors.contact}
                onChange={(value) => on.change("contact", value)}
            />
        </>
    )
}

/** Inputs needed to build the div section. */
interface RenderSimulatorResultContext {
    readonly view: InboxSimulatorBaseProps["props"]
}
/** Builds the div section from the current view. */
const renderSimulatorResult = ({ view }: RenderSimulatorResultContext) => {
    if (view.result === undefined) return null
    return (
        <div className={FORM_WIDE_CLASS}>
            <Alert
                title={view.result.title}
                tone={view.result.tone}
                description={
                    <div className={RESULT_LINKS_CLASS}>
                        {view.result.lines.map((line) => (
                            <Text key={line} size="sm">
                                {line}
                            </Text>
                        ))}
                        {view.result.leadHref === null ? null : (
                            <TextAction href={view.result.leadHref}>{view.labels.resultLead}</TextAction>
                        )}
                        <TextAction href={view.officeHref}>{view.labels.resultOffice}</TextAction>
                    </div>
                }
            />
        </div>
    )
}

/** Message body, amount, items and external reference fields. */
const InboxMessageFields = (props: InboxSimulatorBaseProps) => {
    const view = props.props
    const on = props.on
    const field = { isPending: view.isPending }
    return (
        <>
            <div className={FORM_WIDE_CLASS}>
                <Textarea
                    variant="secondary"
                    label={view.labels.body}
                    name="body"
                    rows={3}
                    isDisabled={view.isPending}
                    value={view.values.body}
                    isInvalid={view.errors.body !== undefined}
                    errorMessage={view.errors.body}
                    onValueChange={(value) => on.change("body", value)}
                />
            </div>
            {view.showItems ? (
                <div className={FORM_WIDE_CLASS}>
                    <InboxTextField
                        {...field}
                        id="sim-items"
                        name="items"
                        label={view.labels.items}
                        value={view.values.items}
                        error={view.errors.items}
                        onChange={(value) => on.change("items", value)}
                    />
                </div>
            ) : null}
            <NumberField
                variant="secondary"
                label={view.labels.amount}
                name="amount"
                minValue={0}
                step={1_000_000}
                formatOptions={{ maximumFractionDigits: 0 }}
                isDisabled={view.isPending}
                value={view.values.amount}
                isInvalid={view.errors.amount !== undefined}
                errorMessage={view.errors.amount}
                onValueChange={(value) => on.change("amount", value)}
            />
            <InboxTextField
                {...field}
                id="sim-ref"
                name="external_ref"
                label={view.labels.reference}
                value={view.values.reference}
                error={view.errors.reference}
                onChange={(value) => on.change("reference", value)}
            />
        </>
    )
}
