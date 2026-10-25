import { Alert, Button, Form, Input, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, FORM_GRID_CLASS_NAME, FORM_WIDE_CLASS_NAME } from "./classNames"

/** The fields of the new-lead form. */
export interface LeadFormValues {
    readonly contact_name: string
    readonly company: string
    readonly channel: string
    readonly need: string
}

/** The words and state of the new-lead form. */
export interface LeadCreateFormBaseProps {
    readonly props: {
        readonly title: string
        readonly intro: string
        readonly contactLabel: string
        readonly contactHint: string
        readonly companyLabel: string
        readonly companyHint: string
        readonly channelLabel: string
        readonly channelHint: string
        readonly channelPlaceholder: string
        readonly channelOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly afterNote: string
        readonly needLabel: string
        readonly needHint: string
        readonly cancelLabel: string
        readonly submitLabel: string
        readonly pendingText: string
        readonly failTitle: string
        readonly values: LeadFormValues
        readonly errors: Partial<Record<keyof LeadFormValues, string>>
        readonly failure: string | null
        readonly isPending: boolean
    }
    readonly on: {
        readonly change: (field: keyof LeadFormValues, value: string) => void
        readonly submit: () => void
        readonly cancel: () => void
    }
}

/** The new-lead form: the contact, the company, the channel and what the lead needs. */
export const LeadCreateFormBase = (props: LeadCreateFormBaseProps) => {
    const { props: p, on } = props
    return (
        <SurfaceCard label={p.title} headingLevel={2}>
            <Form label={p.title} onSubmit={on.submit} isPending={p.isPending}>
                <div className={FORM_GRID_CLASS_NAME}>
                    <div className={FORM_WIDE_CLASS_NAME}>
                        <Text size="sm" tone="muted">
                            {p.intro}
                        </Text>
                    </div>
                    <LeadContactFields {...props} />
                    <Select
                        label={p.channelLabel}
                        name="channel"
                        description={p.channelHint}
                        options={p.channelOptions}
                        placeholder={p.channelPlaceholder}
                        isRequired
                        isDisabled={p.isPending}
                        value={p.values.channel || null}
                        isInvalid={Boolean(p.errors.channel)}
                        errorMessage={p.errors.channel}
                        onValueChange={(value) => on.change("channel", value ?? "")}
                    />
                    <Text size="sm" tone="muted">
                        {p.afterNote}
                    </Text>
                    <div className={FORM_WIDE_CLASS_NAME}>
                        <Textarea
                            label={p.needLabel}
                            name="need"
                            description={p.needHint}
                            rows={4}
                            isRequired
                            isDisabled={p.isPending}
                            value={p.values.need}
                            isInvalid={Boolean(p.errors.need)}
                            errorMessage={p.errors.need}
                            onValueChange={(value) => on.change("need", value)}
                        />
                    </div>
                    {p.failure === null ? null : (
                        <div className={FORM_WIDE_CLASS_NAME}>
                            <Alert title={p.failTitle} description={p.failure} tone="negative" />
                        </div>
                    )}
                    <div className={FORM_WIDE_CLASS_NAME}>
                        <Text live="polite" size="sm" tone="muted">
                            {p.pendingText}
                        </Text>
                    </div>
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button intent="neutral" isDisabled={p.isPending} onPress={on.cancel}>
                            {p.cancelLabel}
                        </Button>
                        <Button intent="commit" type="submit" isPending={p.isPending}>
                            {p.submitLabel}
                        </Button>
                    </div>
                </div>
            </Form>
        </SurfaceCard>
    )
}

/** Required contact and company fields of a new lead. */
const LeadContactFields = (props: LeadCreateFormBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            <Input
                id="lead-contact"
                name="contact_name"
                label={p.contactLabel}
                hint={p.contactHint}
                isRequired
                isDisabled={p.isPending}
                value={p.values.contact_name}
                isError={Boolean(p.errors.contact_name)}
                errorMessage={p.errors.contact_name}
                onValueChange={(value) => on.change("contact_name", value)}
            />
            <Input
                id="lead-company"
                name="company"
                label={p.companyLabel}
                hint={p.companyHint}
                isRequired
                isDisabled={p.isPending}
                value={p.values.company}
                isError={Boolean(p.errors.company)}
                errorMessage={p.errors.company}
                onValueChange={(value) => on.change("company", value)}
            />
        </>
    )
}
