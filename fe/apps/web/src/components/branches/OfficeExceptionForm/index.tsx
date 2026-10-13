import { useState } from "react"
import { Button, Input, RadioGroup, Text, Textarea } from "@starci/grammar/common"
import type { OfficeExceptionView, OfficeText, OfficeWorkDecision } from "@/modules/types"
import { ACTIONS_CLASS_NAME, FIELDS_CLASS_NAME } from "./classNames"

/** What the owner's controls of an exception draw. */
type OfficeExceptionFormProps = {
    readonly item: OfficeExceptionView
    readonly text: OfficeText
    readonly isBusy: boolean
    readonly onDecide: (id: string, choice: OfficeWorkDecision) => void
}

type Values = Readonly<Record<string, string>>

/** The least written basis before an unclear bank credit may be marked paid. */
const BASIS_MIN_CHARS = 10

const REJECTION: Omit<OfficeWorkDecision, "decision"> = {
    draft: null,
    amountVnd: null,
    fields: [],
    candidateId: null,
    basis: null,
}

const digitsOf = (value: string): number | null => {
    const only = value.replace(/[^\d]/g, "")
    return only === "" ? null : Number(only)
}

/** The amount a decision carries: the typed missing amount, or the edited one. */
const amountOf = (item: OfficeExceptionView, isEditing: boolean, amount: string, values: Values): number | null => {
    const typed = values.amount_vnd
    if (typed !== undefined && typed.trim() !== "") return digitsOf(typed)
    if (!isEditing || item.amount === null) return null
    const next = digitsOf(amount)
    return next === item.amount ? null : next
}

/** The owner's controls on an open exception: the missing inputs, the choice, the basis, and approve / edit / reject. */
export const OfficeExceptionForm = (props: OfficeExceptionFormProps) => {
    const { item, text } = props
    const [isEditing, setIsEditing] = useState(false)
    const [values, setValues] = useState<Values>({})
    const [draft, setDraft] = useState(item.draft ?? "")
    const [amount, setAmount] = useState(item.amount === null ? "" : String(item.amount))
    const [candidateId, setCandidateId] = useState<string | null>(null)
    const [basis, setBasis] = useState("")
    const isFailed = item.status === "failed"
    const basisLength = basis.trim().replace(/\s+/g, " ").length
    const isBasisMissing = item.isReconcile && basisLength < BASIS_MIN_CHARS
    const isOtherIncomplete =
        item.missing.some((field) => (values[field.name] ?? "").trim() === "") ||
        (item.choices.length > 0 && candidateId === null)
    const isLocked = props.isBusy || !item.canAct

    const onApprove = () => {
        props.onDecide(item.id, {
            decision: "approved",
            draft: isEditing && item.draft !== null && draft.trim() !== item.draft ? draft.trim() : null,
            amountVnd: amountOf(item, isEditing, amount, values),
            fields: item.missing.map((field) => ({ key: field.name, value: (values[field.name] ?? "").trim() })),
            candidateId,
            basis: item.isReconcile ? basis.trim() : null,
        })
        setIsEditing(false)
    }

    if (item.status !== "open" && item.status !== "failed") return null
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
                    variant="secondary"
                    value={amount}
                    isDisabled={isLocked}
                    onValueChange={setAmount}
                />
            ) : null}
            {item.missing.length > 0 ? (
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
                            variant="secondary"
                            value={values[field.name] ?? ""}
                            isDisabled={isLocked}
                            onValueChange={(next) => setValues((current) => ({ ...current, [field.name]: next }))}
                        />
                    ))}
                </div>
            ) : null}
            {item.choices.length > 0 ? (
                <RadioGroup
                    label={text("exceptionCandidates")}
                    variant="secondary"
                    value={candidateId}
                    isDisabled={isLocked}
                    onValueChange={setCandidateId}
                    options={item.choices.map((choice) => ({
                        value: choice.id,
                        label: choice.label,
                        description: choice.description ?? undefined,
                    }))}
                />
            ) : null}
            {!isFailed && item.isReconcile ? (
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
            ) : null}
            {isOtherIncomplete || isBasisMissing ? (
                <Text size="xs" tone="muted">
                    {isOtherIncomplete ? text("exceptionMissingHint") : text("basisNeeded")}
                </Text>
            ) : null}
            {item.canAct ? null : (
                <Text size="sm" weight="medium" live="polite">
                    {text("waitingManager")}
                </Text>
            )}
            {item.canAct ? (
                <div className={ACTIONS_CLASS_NAME}>
                    {isFailed ? null : (
                        <Button
                            variant="primary"
                            isPending={props.isBusy}
                            isDisabled={isLocked || isOtherIncomplete || isBasisMissing}
                            onPress={onApprove}
                        >
                            {isEditing ? text("exceptionSaveContinue") : text("exceptionApprove")}
                        </Button>
                    )}
                    {isFailed || item.isReconcile || (item.draft === null && item.amount === null) ? null : (
                        <Button variant="outline" isDisabled={isLocked} onPress={() => setIsEditing((value) => !value)}>
                            {isEditing ? text("exceptionCancelEdit") : text("exceptionEditContinue")}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        isDisabled={isLocked}
                        onPress={() => props.onDecide(item.id, { ...REJECTION, decision: "rejected" })}
                    >
                        {text("exceptionReject")}
                    </Button>
                </div>
            ) : null}
        </>
    )
}
