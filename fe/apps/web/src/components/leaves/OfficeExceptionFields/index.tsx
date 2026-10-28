import { Input, RadioGroup, Text, Textarea } from "@starci/grammar/common"
import type { OfficeExceptionView, OfficeText } from "@/modules/types"
import { FIELDS_CLASS_NAME } from "./classNames"

/** The least written basis before an unclear credit may be marked paid. */
export const BASIS_MIN_CHARS = 10

/** The editable proposal fields and their bound updates. */
interface OfficeExceptionFieldsProps {
    readonly item: OfficeExceptionView
    readonly text: OfficeText
    readonly draft: string
    readonly amount: string
    readonly basis: string
    readonly values: Readonly<Record<string, string>>
    readonly candidateId: string | null
    readonly basisLength: number
    readonly isEditing: boolean
    readonly isLocked: boolean
    readonly isBasisMissing: boolean
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
    props: Pick<OfficeExceptionFieldsProps, "text" | "item" | "values" | "isLocked" | "onValues">,
) => {
    const { text, item, values, isLocked, onValues: setValues } = props
    return (
        <div className={FIELDS_CLASS_NAME}>
            <Text size="sm" weight="medium">
                {text("exceptionMissing")}
            </Text>
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
        </div>
    )
}

/** Renders the basis controls. */
const renderBasis = (
    props: Pick<
        OfficeExceptionFieldsProps,
        "item" | "text" | "isBasisMissing" | "basisLength" | "basis" | "isLocked" | "onBasis"
    >,
) => {
    const { item, text, isBasisMissing, basisLength, basis, isLocked, onBasis: setBasis } = props
    return (
        <Textarea
            id={`${item.id}-basis`}
            label={text("basisLabel")}
            description={
                isBasisMissing
                    ? `${text("basisHint", { n: BASIS_MIN_CHARS })} ${text("basisCount", { n: basisLength, min: BASIS_MIN_CHARS })}`
                    : text("basisHint", { n: BASIS_MIN_CHARS })
            }
            placeholder={text("basisPlaceholder")}
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
    props: Pick<OfficeExceptionFieldsProps, "text" | "candidateId" | "isLocked" | "onCandidate" | "item">,
) => {
    const { text, candidateId, isLocked, onCandidate: setCandidateId, item } = props
    return (
        <RadioGroup
            label={text("exceptionCandidates")}
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
        "item" | "text" | "draft" | "amount" | "isEditing" | "isLocked" | "onDraft" | "onAmount"
    >,
) => {
    const { item, text, draft, amount, isEditing, isLocked, onDraft: setDraft, onAmount: setAmount } = props
    return (
        <>
            {isEditing && item.draft !== null ? (
                <Textarea
                    label={text("exceptionDraft")}
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
                    label={text("exceptionAmount")}
                    value={amount}
                    isDisabled={isLocked}
                    onValueChange={setAmount}
                />
            ) : null}
        </>
    )
}
