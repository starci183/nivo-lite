import { Alert, Grid, Input, Select, Stack, Text, Textarea } from "@starci/grammar/common"
import { LeadDialogShell } from "@/components/composites/LeadDialogShell"
import type { LeadCreateDialogProps } from "@/modules/types"

/** The fields of a new lead: the contact and company side by side, the channel, then what the customer needs. */
const Fields = (props: LeadCreateDialogProps) => {
    const { props: p, on } = props
    return (
        <Stack gap="row">
            <Grid kind="form" columns={2}>
                <Input
                    id="lead-contact"
                    name="contact_name"
                    label={p.contactLabel}
                    description={p.contactHint}
                    isRequired
                    isDisabled={p.isPending}
                    value={p.values.contact_name}
                    isInvalid={Boolean(p.errors.contact_name)}
                    errorMessage={p.errors.contact_name}
                    onValueChange={(value) => on.change("contact_name", value)}
                />
                <Input
                    id="lead-company"
                    name="company"
                    label={p.companyLabel}
                    description={p.companyHint}
                    isRequired
                    isDisabled={p.isPending}
                    value={p.values.company}
                    isInvalid={Boolean(p.errors.company)}
                    errorMessage={p.errors.company}
                    onValueChange={(value) => on.change("company", value)}
                />
            </Grid>
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
        </Stack>
    )
}

/** The new-lead dialog: the four fields, an error under the field that needs it, and what happens after the lead is created. */
export const LeadCreateDialog = (props: LeadCreateDialogProps) => {
    const { props: p, on } = props
    return (
        <LeadDialogShell
            isOpen={p.isOpen}
            title={p.title}
            description={p.intro}
            closeLabel={p.cancelLabel}
            submitLabel={p.submitLabel}
            isPending={p.isPending}
            onClose={on.close}
            onSubmit={on.submit}
            fields={
                <>
                    <Fields {...props} />
                    <Text size="sm" tone="muted">
                        {p.afterNote}
                    </Text>
                    {p.submitError === null ? null : (
                        <Alert title={p.failTitle} description={p.submitError} tone="negative" />
                    )}
                    <Text live="polite" size="sm" tone="muted">
                        {p.pendingText}
                    </Text>
                </>
            }
        />
    )
}
