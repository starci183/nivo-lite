import { parseDate } from "@internationalized/date"
import { Alert, Button, DateField, Form, Input, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { AccountingFormActions } from "@/components/branches/AccountingFormActions"
import { AccountingRecordSection } from "@/components/branches/AccountingRecordSection"
import type { AccountingRecordView } from "@/hooks/accountingRecords"
import type { AccountingEvidenceValues } from "@/hooks/rhf"
import { FORM_CLASS_NAME, FORM_GRID_CLASS_NAME, FORM_WIDE_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames"

/** The manual evidence form: its words, its values and how the last save went. */
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
                    <div className={FORM_GRID_CLASS_NAME}>
                        <Input
                            id="wb-acc-amount"
                            name="amount"
                            label={form.amountLabel}
                            variant="secondary"
                            value={form.amount}
                            isRequired
                            isDisabled={form.isSaving}
                            hint={form.amountHint ?? undefined}
                            onValueChange={(value) => props.on.changeField("amount", value)}
                        />
                        <DateField
                            name="date"
                            label={form.dateLabel}
                            variant="secondary"
                            isRequired
                            isDisabled={form.isSaving}
                            value={parseDate(form.date)}
                            maxValue={parseDate(form.maxDate)}
                            onValueChange={(value) =>
                                props.on.changeField("date", value === null ? "" : value.toString())
                            }
                        />
                        <div className={FORM_WIDE_CLASS_NAME}>
                            <Input
                                id="wb-acc-content"
                                name="content"
                                label={form.contentLabel}
                                variant="secondary"
                                value={form.content}
                                isRequired
                                isDisabled={form.isSaving}
                                hint={form.contentHint}
                                onValueChange={(value) => props.on.changeField("content", value)}
                            />
                        </div>
                        <div className={FORM_WIDE_CLASS_NAME}>
                            <Input
                                id="wb-acc-payer"
                                name="payer"
                                label={form.payerLabel}
                                variant="secondary"
                                value={form.payer}
                                isDisabled={form.isSaving}
                                onValueChange={(value) => props.on.changeField("payer", value)}
                            />
                        </div>
                        <div className={FORM_WIDE_CLASS_NAME}>
                            <Textarea
                                id="wb-acc-note"
                                name="note"
                                label={form.noteLabel}
                                variant="secondary"
                                rows={3}
                                value={form.note}
                                isDisabled={form.isSaving}
                                onValueChange={(value) => props.on.changeField("note", value)}
                            />
                        </div>
                    </div>
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
