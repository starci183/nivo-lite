import { parseDate } from "@internationalized/date"
import { Input, DateField, Grid, Stack, Textarea } from "@starci/grammar/common"

/** The name of one manual evidence input. */
export type AccountingEvidenceFieldName = "amount" | "date" | "content" | "payer" | "note"

/** The manual evidence inputs: the words and entered values arrive whole, the state they edit lives in the panel. */
interface AccountingEvidenceFieldsProps {
    readonly amountLabel: string
    readonly amount: string
    readonly amountHint: string | null
    readonly dateLabel: string
    /** yyyy-mm-dd */
    readonly date: string
    readonly maxDate: string
    readonly contentLabel: string
    readonly content: string
    readonly contentHint: string
    readonly payerLabel: string
    readonly payer: string
    readonly noteLabel: string
    readonly note: string
    readonly isSaving: boolean
    readonly onChange: (name: AccountingEvidenceFieldName, value: string) => void
}

/** Renders amount, date, content, payer and note inputs for manual evidence. */
export const AccountingEvidenceFields = (props: AccountingEvidenceFieldsProps) => (
    <Stack gap="section">
        <Grid kind="form">
            <Input
                id="wb-acc-amount"
                name="amount"
                label={props.amountLabel}
                value={props.amount}
                isRequired
                isDisabled={props.isSaving}
                description={props.amountHint ?? undefined}
                onValueChange={(value) => props.onChange("amount", value)}
            />
            <DateField
                name="date"
                label={props.dateLabel}
                isRequired
                isDisabled={props.isSaving}
                value={parseDate(props.date)}
                maxValue={parseDate(props.maxDate)}
                onValueChange={(value) => props.onChange("date", value === null ? "" : value.toString())}
            />
        </Grid>
        <Grid kind="form" columns={1}>
            <Input
                id="wb-acc-content"
                name="content"
                label={props.contentLabel}
                value={props.content}
                isRequired
                isDisabled={props.isSaving}
                description={props.contentHint}
                onValueChange={(value) => props.onChange("content", value)}
            />
            <Input
                id="wb-acc-payer"
                name="payer"
                label={props.payerLabel}
                value={props.payer}
                isDisabled={props.isSaving}
                onValueChange={(value) => props.onChange("payer", value)}
            />
            <Textarea
                id="wb-acc-note"
                name="note"
                label={props.noteLabel}
                rows={3}
                value={props.note}
                isDisabled={props.isSaving}
                onValueChange={(value) => props.onChange("note", value)}
            />
        </Grid>
    </Stack>
)
