import { Alert, Button, Form, Input, NumberField, Select, SurfaceCard, Text, TextAction, Textarea } from "@starci/grammar/common"
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

/** One option of a select. */
export interface SimulatorOption {
    readonly id: string
    readonly label: string
}

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
        readonly presets: ReadonlyArray<SimulatorOption>
        readonly labels: Readonly<Record<"channel" | "kind" | "name" | "nameHint" | "contact" | "body" | "items" | "amount" | "reference" | "eventId" | "eventIdHint" | "eventIdNew" | "submit" | "failTitle" | "resultLead" | "resultOffice", string>>
        readonly channels: ReadonlyArray<SimulatorOption>
        readonly kinds: ReadonlyArray<SimulatorOption>
        readonly values: SimulatorValues
        readonly showItems: boolean
        readonly nameError: string | undefined
        readonly failure: string | undefined
        readonly result: SimulatorResult | undefined
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
export const InboxSimulatorBase = ({ props, on }: InboxSimulatorBaseProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <div className={STACK_CLASS}>
            <Text size="sm" tone="muted">
                {props.description}
            </Text>
            <Text size="sm" weight="medium">
                {props.presetsLabel}
            </Text>
            <div className={PRESETS_CLASS}>
                {props.presets.map((preset) => (
                    <Button key={preset.id} variant="outline" onPress={() => on.preset(preset.id)}>
                        {preset.label}
                    </Button>
                ))}
            </div>
            <Form label={props.title} onSubmit={on.submit} isPending={props.isPending}>
                <div className={FORM_GRID_CLASS}>
                    <Select variant="secondary" label={props.labels.channel} name="channel" options={[...props.channels]} value={props.values.channel} isDisabled={props.isPending} onValueChange={(value) => on.change("channel", value ?? "")} />
                    <Select variant="secondary" label={props.labels.kind} name="kind" options={[...props.kinds]} value={props.values.kind} isDisabled={props.isPending} onValueChange={(value) => on.change("kind", value ?? "")} />
                    <Input id="sim-name" name="sender_name" label={props.labels.name} hint={props.labels.nameHint} variant="secondary" isRequired isDisabled={props.isPending} value={props.values.name} isError={props.nameError !== undefined} errorMessage={props.nameError} onValueChange={(value) => on.change("name", value)} />
                    <Input id="sim-contact" name="sender_contact" label={props.labels.contact} variant="secondary" isDisabled={props.isPending} value={props.values.contact} onValueChange={(value) => on.change("contact", value)} />
                    <div className={FORM_WIDE_CLASS}>
                        <Textarea variant="secondary" label={props.labels.body} name="body" rows={3} isDisabled={props.isPending} value={props.values.body} onValueChange={(value) => on.change("body", value)} />
                    </div>
                    {props.showItems ? (
                        <div className={FORM_WIDE_CLASS}>
                            <Input id="sim-items" name="items" label={props.labels.items} variant="secondary" isDisabled={props.isPending} value={props.values.items} onValueChange={(value) => on.change("items", value)} />
                        </div>
                    ) : null}
                    <NumberField variant="secondary" label={props.labels.amount} name="amount" minValue={0} step={1_000_000} formatOptions={{ maximumFractionDigits: 0 }} isDisabled={props.isPending} value={props.values.amount} onValueChange={(value) => on.change("amount", value)} />
                    <Input id="sim-ref" name="external_ref" label={props.labels.reference} variant="secondary" isDisabled={props.isPending} value={props.values.reference} onValueChange={(value) => on.change("reference", value)} />
                    <div className={EVENT_ID_ROW_CLASS}>
                        <div className={EVENT_ID_INPUT_CLASS}>
                            <Input id="sim-event-id" name="event_id" label={props.labels.eventId} hint={props.labels.eventIdHint} variant="secondary" isDisabled={props.isPending} value={props.values.eventId} onValueChange={(value) => on.change("eventId", value)} />
                        </div>
                        <Button variant="outline" isDisabled={props.isPending} onPress={on.newEventId}>
                            {props.labels.eventIdNew}
                        </Button>
                    </div>
                    {props.failure === undefined ? null : (
                        <div className={FORM_WIDE_CLASS}>
                            <Alert title={props.labels.failTitle} description={props.failure} tone="negative" />
                        </div>
                    )}
                    {props.result === undefined ? null : (
                        <div className={FORM_WIDE_CLASS}>
                            <Alert
                                title={props.result.title}
                                tone={props.result.tone}
                                description={
                                    <span className={RESULT_LINKS_CLASS}>
                                        {props.result.lines.map((line) => (
                                            <span key={line}>{line}</span>
                                        ))}
                                        {props.result.leadHref === null ? null : <TextAction href={props.result.leadHref}>{props.labels.resultLead}</TextAction>}
                                        <TextAction href="/chat">{props.labels.resultOffice}</TextAction>
                                    </span>
                                }
                            />
                        </div>
                    )}
                    <div className={SUBMIT_ROW_CLASS}>
                        <Button variant="primary" type="submit" isPending={props.isPending}>
                            {props.labels.submit}
                        </Button>
                    </div>
                </div>
            </Form>
        </div>
    </SurfaceCard>
)
