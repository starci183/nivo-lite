import { Input, Textarea } from "@starci/grammar/common"
import { FORM_CLASS_NAME } from "./classNames"

/** One data field NIVO is missing and the person fills in. */
interface MissingFieldView {
    readonly name: string
    readonly label: string
    readonly value: string
}

/** The fields a person can fill in on one pending decision, with their values and the commands that change them. */
interface SalesDecisionFieldsProps {
    /** The in-page anchor the field ids derive from. */
    readonly anchor: string
    readonly missing: ReadonlyArray<MissingFieldView>
    readonly showDraftField: boolean
    readonly draftLabel: string
    readonly draftValue: string
    readonly showAmountField: boolean
    readonly amountLabel: string
    readonly amountValue: string
    readonly isBusy: boolean
    readonly onField: (name: string, value: string) => void
    readonly onDraft: (value: string) => void
    readonly onAmount: (value: string) => void
}

/** The missing fields, the editable draft and the editable amount of one pending decision. */
export const SalesDecisionFields = (props: SalesDecisionFieldsProps) => (
    <div className={FORM_CLASS_NAME}>
        {props.missing.map((field) => (
            <Input
                key={field.name}
                id={`${props.anchor}-${field.name}`}
                name={field.name}
                label={field.label}
                variant="secondary"
                value={field.value}
                isDisabled={props.isBusy}
                onValueChange={(value) => props.onField(field.name, value)}
            />
        ))}
        {props.showDraftField ? (
            <Textarea
                label={props.draftLabel}
                variant="secondary"
                rows={4}
                value={props.draftValue}
                isDisabled={props.isBusy}
                onValueChange={props.onDraft}
            />
        ) : null}
        {props.showAmountField ? (
            <Input
                id={`${props.anchor}-amount`}
                name="amount_vnd"
                label={props.amountLabel}
                variant="secondary"
                value={props.amountValue}
                isDisabled={props.isBusy}
                onValueChange={props.onAmount}
            />
        ) : null}
    </div>
)
