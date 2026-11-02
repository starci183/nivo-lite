import { Input, Stack, Textarea } from "@starci/grammar/common"
import { DecisionMissingInputs } from "@/components/leaves/DecisionMissingInputs"

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
    readonly isLoading?: boolean
    readonly onField: (name: string, value: string) => void
    readonly onDraft: (value: string) => void
    readonly onAmount: (value: string) => void
}

/** The missing fields, the editable draft and the editable amount of one pending decision. */
export const SalesDecisionFields = (props: SalesDecisionFieldsProps) => (
    <Stack gap="row">
        <DecisionMissingInputs
            idPrefix={props.anchor}
            fields={props.missing}
            isDisabled={props.isBusy}
            isLoading={props.isLoading === true}
            onField={props.onField}
        />
        {props.showDraftField ? (
            <Textarea
                label={props.draftLabel}
                rows={4}
                value={props.draftValue}
                isDisabled={props.isBusy}
                isLoading={props.isLoading === true}
                onValueChange={props.onDraft}
            />
        ) : null}
        {props.showAmountField ? (
            <Input
                id={`${props.anchor}-amount`}
                name="amount_vnd"
                label={props.amountLabel}
                value={props.amountValue}
                isDisabled={props.isBusy}
                isLoading={props.isLoading === true}
                onValueChange={props.onAmount}
            />
        ) : null}
    </Stack>
)
