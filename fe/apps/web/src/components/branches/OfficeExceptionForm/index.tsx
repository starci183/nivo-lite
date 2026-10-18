import { OfficeExceptionFields, BASIS_MIN_CHARS } from "@/components/leaves/OfficeExceptionFields"
import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { Button, Text } from "@starci/grammar/common"
import type { OfficeExceptionView, OfficeText, OfficeWorkDecision } from "@/modules/types"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** What the owner's controls of an exception draw. */
type OfficeExceptionFormProps = {
    readonly item: OfficeExceptionView
    readonly text: OfficeText
    readonly isBusy: boolean
    readonly onDecide: (id: string, choice: OfficeWorkDecision) => void
}

type Values = Readonly<Record<string, string>>

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
            <OfficeExceptionFields
                item={item}
                text={text}
                draft={draft}
                amount={amount}
                isEditing={isEditing}
                isLocked={isLocked}
                values={values}
                candidateId={candidateId}
                basis={basis}
                basisLength={basisLength}
                isBasisMissing={isBasisMissing}
                isFailed={isFailed}
                onDraft={setDraft}
                onAmount={setAmount}
                onValues={setValues}
                onCandidate={setCandidateId}
                onBasis={setBasis}
            />
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
            {item.canAct
                ? renderOfficeExceptionFormActions({
                      isFailed,
                      props,
                      isLocked,
                      isOtherIncomplete,
                      isBasisMissing,
                      onApprove,
                      isEditing,
                      text,
                      item,
                      setIsEditing,
                  })
                : null}
        </>
    )
}

/** Renders the OfficeExceptionForm actions section. */
type OfficeExceptionActionsInput = {
    readonly isFailed: boolean
    readonly props: OfficeExceptionFormProps
    readonly isLocked: boolean
    readonly isOtherIncomplete: boolean
    readonly isBasisMissing: boolean
    readonly onApprove: () => void
    readonly isEditing: boolean
    readonly text: NonNullable<OfficeExceptionFormProps["text"]>
    readonly item: NonNullable<OfficeExceptionFormProps["item"]>
    readonly setIsEditing: Dispatch<SetStateAction<boolean>>
}

const renderOfficeExceptionFormActions = ({
    isFailed,
    props,
    isLocked,
    isOtherIncomplete,
    isBasisMissing,
    onApprove,
    isEditing,
    text,
    item,
    setIsEditing,
}: OfficeExceptionActionsInput) => (
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
)
