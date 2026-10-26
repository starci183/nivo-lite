import { parseDate } from "@internationalized/date"
import { Input, DateField, Textarea } from "@starci/grammar/common"
import type { AccountingEvidenceValues } from "@/hooks/rhf"
import { FORM_GRID_CLASS_NAME, FORM_WIDE_CLASS_NAME } from "./classNames"
/** The words and entered values of the manual evidence form. */
export interface EvidenceForm {
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

/** The manual evidence inputs and their update callback. */
interface AccountingEvidenceFieldsProps {
    readonly form: Pick<
        EvidenceForm,
        | "amountLabel"
        | "amount"
        | "isSaving"
        | "amountHint"
        | "dateLabel"
        | "date"
        | "maxDate"
        | "contentLabel"
        | "content"
        | "contentHint"
        | "payerLabel"
        | "payer"
        | "noteLabel"
        | "note"
    >
    readonly onChange: (name: keyof AccountingEvidenceValues, value: string) => void
}

/** Renders amount, date, content, payer and note inputs for manual evidence. */
export const AccountingEvidenceFields = (props: AccountingEvidenceFieldsProps) => {
    const form = props.form
    return (
        <div className={FORM_GRID_CLASS_NAME}>
            <Input
                id="wb-acc-amount"
                name="amount"
                label={form.amountLabel}
                value={form.amount}
                isRequired
                isDisabled={form.isSaving}
                hint={form.amountHint ?? undefined}
                onValueChange={(value) => props.onChange("amount", value)}
            />
            <DateField
                name="date"
                label={form.dateLabel}
                isRequired
                isDisabled={form.isSaving}
                value={parseDate(form.date)}
                maxValue={parseDate(form.maxDate)}
                onValueChange={(value) => props.onChange("date", value === null ? "" : value.toString())}
            />
            <div className={FORM_WIDE_CLASS_NAME}>
                <Input
                    id="wb-acc-content"
                    name="content"
                    label={form.contentLabel}
                    value={form.content}
                    isRequired
                    isDisabled={form.isSaving}
                    hint={form.contentHint}
                    onValueChange={(value) => props.onChange("content", value)}
                />
            </div>
            <div className={FORM_WIDE_CLASS_NAME}>
                <Input
                    id="wb-acc-payer"
                    name="payer"
                    label={form.payerLabel}
                    value={form.payer}
                    isDisabled={form.isSaving}
                    onValueChange={(value) => props.onChange("payer", value)}
                />
            </div>
            <div className={FORM_WIDE_CLASS_NAME}>
                <Textarea
                    id="wb-acc-note"
                    name="note"
                    label={form.noteLabel}
                    rows={3}
                    value={form.note}
                    isDisabled={form.isSaving}
                    onValueChange={(value) => props.onChange("note", value)}
                />
            </div>
        </div>
    )
}
