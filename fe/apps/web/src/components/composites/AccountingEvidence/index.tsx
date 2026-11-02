import type { ReactNode } from "react"
import { AccountingEvidenceFields } from "@/components/leaves/AccountingEvidenceFields"
import type { AccountingEvidenceFieldName } from "@/components/leaves/AccountingEvidenceFields"

import { Alert, Badge, Button, Form, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { AccountingFormActions } from "@/components/branches/AccountingFormActions"
import type { AccountingRecordView } from "@/hooks/accountingRecords"

/** The words and entered values of the manual evidence form. */
interface EvidenceForm {
    readonly title: string
    readonly intro: string
    readonly amountLabel: string
    readonly amountHint: string | null
    readonly dateLabel: string
    readonly contentLabel: string
    readonly contentHint: string
    readonly payerLabel: string
    readonly noteLabel: string
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly foot: string
    readonly amount: string
    /** yyyy-mm-dd */
    readonly date: string
    readonly maxDate: string
    readonly content: string
    readonly payer: string
    readonly note: string
    readonly isSaving: boolean
    readonly error: string | null
    readonly notice: string | null
}

/** A feature that works once a connector is connected: what it gives and where to connect it. */
interface EvidenceNeed {
    readonly title: string
    readonly body: string
    readonly badge: string
    readonly actionLabel: string
    readonly actionHref: string
}

/** The resolved words and rows of the Evidence tab. */
interface AccountingEvidenceProps {
    readonly credits: ReactNode
    readonly invoices: ReactNode
    readonly orders: ReactNode
    readonly props: {
        readonly creditsTitle: string
        readonly creditsIntro: string
        readonly creditsEmpty: string
        readonly creditsEmptyBody: string
        readonly credits: ReadonlyArray<AccountingRecordView>
        readonly invoicesTitle: string
        readonly invoicesIntro: string
        readonly invoicesEmpty: string
        readonly invoicesEmptyBody: string
        readonly internalNote: string
        readonly invoices: ReadonlyArray<AccountingRecordView>
        readonly ordersTitle: string
        readonly ordersIntro: string
        readonly ordersEmpty: string
        readonly ordersEmptyBody: string
        readonly orders: ReadonlyArray<AccountingRecordView>
        /** Supplier invoices need an invoice connector: drawn only while none is connected. */
        readonly supplierNeed: EvidenceNeed | null
        readonly isFormOpen: boolean
        readonly formOpenLabel: string
        readonly form: EvidenceForm
    }
    /** The panel is drawn from placeholders: its leaves draw as skeleton. */
    readonly isLoading: boolean
}

/** The commands used by the evidence form. */
interface AccountingEvidenceFormActions {
    readonly closeForm: () => void
    readonly changeField: (name: AccountingEvidenceFieldName, value: string) => void
    readonly submitForm: () => void
}

/** The form's words and values, and what it does. */
interface AccountingEvidenceFormProps {
    readonly form: EvidenceForm
    readonly on: AccountingEvidenceFormActions
}

/** The "add manual evidence" form: the owner states money that arrived and NIVO tries to match it to an invoice. */
export const AccountingEvidenceForm = (props: AccountingEvidenceFormProps) => {
    const form = props.form
    return (
        <SurfaceCard label={form.title}>
            <Form label={form.title} isPending={form.isSaving} onSubmit={props.on.submitForm}>
                <Stack gap="section">
                    <Text size="sm" tone="muted">
                        {form.intro}
                    </Text>
                    <AccountingEvidenceFields {...form} onChange={props.on.changeField} />
                    {form.error === null ? null : <Alert tone="negative" title={form.error} />}
                    {form.notice === null ? null : <Alert tone="cautionary" title={form.notice} />}
                    <AccountingFormActions
                        cancelLabel={form.cancelLabel}
                        saveLabel={form.saveLabel}
                        isSaving={form.isSaving}
                        onCancel={props.on.closeForm}
                    />
                    <Text size="xs" tone="muted">
                        {form.foot}
                    </Text>
                </Stack>
            </Form>
        </SurfaceCard>
    )
}

/** Bank credits with match state, invoices with status, orders still without an invoice, and the manual evidence form. */
export const AccountingEvidence = (props: AccountingEvidenceProps) => {
    const { props: data } = props
    const isLoading = props.isLoading
    return (
        <Stack gap="region">
            {props.credits}
            {props.invoices}
            {props.orders}
            {data.supplierNeed === null ? null : (
                <SurfaceCard label={data.supplierNeed.title}>
                    <Stack gap="row" align="start">
                        <Badge tone="warning" isLoading={isLoading}>
                            {data.supplierNeed.badge}
                        </Badge>
                        <Text size="sm" tone="muted" isLoading={isLoading}>
                            {data.supplierNeed.body}
                        </Text>
                        <div>
                            <Button intent="neutral" href={data.supplierNeed.actionHref} isLoading={isLoading}>
                                {data.supplierNeed.actionLabel}
                            </Button>
                        </div>
                    </Stack>
                </SurfaceCard>
            )}
        </Stack>
    )
}
