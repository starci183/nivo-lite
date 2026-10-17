import { AccountingEvidenceFields } from "@/components/leaves/AccountingEvidenceFields"
import type { EvidenceForm } from "@/components/leaves/AccountingEvidenceFields"

import { Alert, Button, Form, SurfaceCard, Text } from "@starci/grammar/common"
import { AccountingFormActions } from "@/components/branches/AccountingFormActions"
import { AccountingRecordSection } from "@/components/branches/AccountingRecordSection"
import type { AccountingRecordView } from "@/hooks/accountingRecords"
import type { AccountingEvidenceValues } from "@/hooks/rhf"
import { FORM_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

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
        readonly isFormOpen: boolean
        readonly formOpenLabel: string
        readonly form: EvidenceForm
    }
    readonly on: {
        readonly openForm: () => void
        readonly closeForm: () => void
        readonly changeField: (name: keyof AccountingEvidenceValues, value: string) => void
        readonly submitForm: () => void
    }
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
                    {<AccountingEvidenceFields form={form} onChange={props.on.changeField} />}
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
    return (
        <div className={PANEL_CLASS_NAME}>
            <AccountingRecordSection
                title={data.creditsTitle}
                intro={data.creditsIntro}
                empty={data.creditsEmpty}
                emptyBody={data.creditsEmptyBody}
                records={data.credits}
                action={data.isFormOpen ? undefined : <Button onPress={on.openForm}>{data.formOpenLabel}</Button>}
            >
                {data.isFormOpen ? <ManualEvidenceForm form={data.form} on={on} /> : null}
            </AccountingRecordSection>
            <AccountingRecordSection
                title={data.invoicesTitle}
                intro={data.invoicesIntro}
                empty={data.invoicesEmpty}
                emptyBody={data.invoicesEmptyBody}
                records={data.invoices}
                note={data.internalNote}
            />
            <AccountingRecordSection
                title={data.ordersTitle}
                intro={data.ordersIntro}
                empty={data.ordersEmpty}
                emptyBody={data.ordersEmptyBody}
                records={data.orders}
            />
        </div>
    )
}

/** The settled atoms of the AccountingEvidence surface. */
export type AccountingEvidenceView = AccountingEvidenceProps["props"]
