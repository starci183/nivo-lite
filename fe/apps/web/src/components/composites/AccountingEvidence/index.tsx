import { AccountingEvidenceFields } from "@/components/leaves/AccountingEvidenceFields"
import type { AccountingEvidenceFieldName } from "@/components/leaves/AccountingEvidenceFields"

import { Alert, Badge, Button, Form, SurfaceCard, Text } from "@starci/grammar/common"
import { AccountingFormActions } from "@/components/branches/AccountingFormActions"
import { AccountingRecordSection } from "@/components/branches/AccountingRecordSection"
import type { AccountingRecordView } from "@/hooks/accountingRecords"
import { FORM_CLASS_NAME, NEED_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

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
    readonly on: {
        readonly openForm: () => void
        readonly closeForm: () => void
        readonly changeField: (name: AccountingEvidenceFieldName, value: string) => void
        readonly submitForm: () => void
    }
    /** The panel is drawn from placeholders: its leaves draw as skeleton. */
    readonly isSkeleton: boolean
}

/** The form's words and values, and what it does. */
interface ManualEvidenceFormProps {
    readonly form: EvidenceForm
    readonly on: AccountingEvidenceProps["on"]
}

/** The "add manual evidence" form: the owner states money that arrived and NIVO tries to match it to an invoice. */
const ManualEvidenceForm = (props: ManualEvidenceFormProps) => {
    const form = props.form
    return (
        <SurfaceCard label={form.title}>
            <Form label={form.title} isPending={form.isSaving} onSubmit={props.on.submitForm}>
                <div className={FORM_CLASS_NAME}>
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
                </div>
            </Form>
        </SurfaceCard>
    )
}

/** Bank credits with match state, invoices with status, orders still without an invoice, and the manual evidence form. */
export const AccountingEvidence = (props: AccountingEvidenceProps) => {
    const { props: data, on } = props
    const isSkeleton = props.isSkeleton
    return (
        <div className={PANEL_CLASS_NAME}>
            <AccountingRecordSection
                title={data.creditsTitle}
                intro={data.creditsIntro}
                empty={data.creditsEmpty}
                emptyBody={data.creditsEmptyBody}
                records={data.credits}
                isSkeleton={isSkeleton}
                action={
                    data.isFormOpen ? undefined : (
                        <Button intent="neutral" isSkeleton={isSkeleton} onPress={on.openForm}>
                            {data.formOpenLabel}
                        </Button>
                    )
                }
            >
                {data.isFormOpen ? <ManualEvidenceForm form={data.form} on={on} /> : null}
            </AccountingRecordSection>
            <AccountingRecordSection
                title={data.invoicesTitle}
                intro={data.invoicesIntro}
                empty={data.invoicesEmpty}
                emptyBody={data.invoicesEmptyBody}
                records={data.invoices}
                isSkeleton={isSkeleton}
                note={data.internalNote}
            />
            <AccountingRecordSection
                title={data.ordersTitle}
                intro={data.ordersIntro}
                empty={data.ordersEmpty}
                emptyBody={data.ordersEmptyBody}
                records={data.orders}
                isSkeleton={isSkeleton}
            />
            {data.supplierNeed === null ? null : (
                <SurfaceCard label={data.supplierNeed.title}>
                    <div className={NEED_CLASS_NAME}>
                        <Badge tone="warning" isSkeleton={isSkeleton}>
                            {data.supplierNeed.badge}
                        </Badge>
                        <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                            {data.supplierNeed.body}
                        </Text>
                        <div>
                            <Button intent="neutral" href={data.supplierNeed.actionHref} isSkeleton={isSkeleton}>
                                {data.supplierNeed.actionLabel}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            )}
        </div>
    )
}

/** The settled atoms of the AccountingEvidence surface. */
export type AccountingEvidenceView = AccountingEvidenceProps["props"]

/** What the evidence does, handed in by its panel. */
export type AccountingEvidenceOn = AccountingEvidenceProps["on"]
