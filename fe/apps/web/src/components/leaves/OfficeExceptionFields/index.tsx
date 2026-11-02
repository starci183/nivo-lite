import { Fieldset, Input, RadioGroup, Textarea } from "@starci/grammar/common"
import type { OfficeExceptionView, OfficeThreadProps } from "@/modules/types"

/** The editable proposal fields and their bound updates. */
interface OfficeExceptionFieldsProps {
    readonly item: OfficeExceptionView
    readonly copy: OfficeThreadProps["props"]["cardCopy"]["exceptionForm"]
    readonly basisDescription: string | null
    readonly draft: string
    readonly amount: string
    readonly basis: string
    readonly values: Readonly<Record<string, string>>
    readonly candidateId: string | null
    readonly isEditing: boolean
    readonly isLocked: boolean
    readonly onDraft: (value: string) => void
    readonly onAmount: (value: string) => void
    readonly onBasis: (value: string) => void
    readonly onCandidate: (value: string | null) => void
    readonly onValues: (update: (current: Readonly<Record<string, string>>) => Readonly<Record<string, string>>) => void
}

/** Renders the editable proposal, missing inputs, candidate choice and reconciliation basis. */
export const OfficeExceptionFields = (props: OfficeExceptionFieldsProps) => (
    <>
        {renderDraft(props)}
        {props.item.missing.length > 0 ? renderMissingFields(props) : null}
        {props.item.choices.length > 0 ? renderCandidates(props) : null}
        {props.item.status !== "failed" && props.item.isReconcile ? renderBasis(props) : null}
    </>
)

/** Renders the missingfields controls. */
const renderMissingFields = (
    props: Pick<OfficeExceptionFieldsProps, "copy" | "item" | "values" | "isLocked" | "onValues">,
) => {
    const { copy, item, values, isLocked, onValues: setValues } = props
    return (
        <Fieldset legend={copy.exceptionMissing}>
            {item.missing.map((field) => (
                <Input
                    key={field.name}
                    id={`${item.id}-${field.name}`}
                    name={field.name}
                    label={field.label}
                    value={values[field.name] ?? ""}
                    isDisabled={isLocked}
                    onValueChange={(next) => setValues((current) => ({ ...current, [field.name]: next }))}
                />
            ))}
        </Fieldset>
    )
}

/** Renders the basis controls. */
const renderBasis = (
    props: Pick<OfficeExceptionFieldsProps, "item" | "copy" | "basisDescription" | "basis" | "isLocked" | "onBasis">,
) => {
    const { item, copy, basis, isLocked, onBasis: setBasis } = props
    return (
        <Textarea
            id={`${item.id}-basis`}
            label={copy.basisLabel}
            description={props.basisDescription ?? undefined}
            placeholder={copy.basisPlaceholder}
            isRequired
            rows={2}
            value={basis}
            isDisabled={isLocked}
            onValueChange={setBasis}
        />
    )
}

/** Renders the candidates controls. */
const renderCandidates = (
    props: Pick<OfficeExceptionFieldsProps, "copy" | "candidateId" | "isLocked" | "onCandidate" | "item">,
) => {
    const { copy, candidateId, isLocked, onCandidate: setCandidateId, item } = props
    return (
        <RadioGroup
            label={copy.exceptionCandidates}
            value={candidateId}
            isDisabled={isLocked}
            onValueChange={setCandidateId}
            options={item.choices.map((choice) => ({
                value: choice.id,
                label: choice.label,
                description: choice.description ?? undefined,
            }))}
        />
    )
}

/** Renders the draft controls. */
const renderDraft = (
    props: Pick<
        OfficeExceptionFieldsProps,
        "item" | "copy" | "draft" | "amount" | "isEditing" | "isLocked" | "onDraft" | "onAmount"
    >,
) => {
    const { item, copy, draft, amount, isEditing, isLocked, onDraft: setDraft, onAmount: setAmount } = props
    return (
        <>
            {isEditing && item.draft !== null ? (
                <Textarea
                    label={copy.exceptionDraft}
                    rows={4}
                    value={draft}
                    isDisabled={isLocked}
                    onValueChange={setDraft}
                />
            ) : null}
            {isEditing && item.amount !== null ? (
                <Input
                    id={`${item.id}-amount`}
                    name="amount_vnd"
                    label={copy.exceptionAmount}
                    value={amount}
                    isDisabled={isLocked}
                    onValueChange={setAmount}
                />
            ) : null}
        </>
    )
}
