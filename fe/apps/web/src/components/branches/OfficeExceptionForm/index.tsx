import { OfficeExceptionFields, BASIS_MIN_CHARS } from "@/components/leaves/OfficeExceptionFields"
import { Button, Cluster, Text } from "@starci/grammar/common"
import type { OfficeCardDraft, OfficeExceptionView, OfficeText, OfficeWorkDecision } from "@/modules/types"

/** What the owner's controls of an exception draw. */
type OfficeExceptionFormProps = {
    readonly item: OfficeExceptionView
    readonly text: OfficeText
    /** What the owner typed on this exception, kept by the thread's block. */
    readonly draft: OfficeCardDraft
    readonly onEdit: (key: string, patch: Partial<OfficeCardDraft>) => void
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
    const { isEditing, values, candidateId, basis } = props.draft
    const draft = props.draft.text ?? item.draft ?? ""
    const amount = props.draft.amount ?? (item.amount === null ? "" : String(item.amount))
    const edit = (patch: Partial<OfficeCardDraft>) => props.onEdit(item.key, patch)
    const setIsEditing = (value: boolean) => edit({ isEditing: value })
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
                onDraft={(value) => edit({ text: value })}
                onAmount={(value) => edit({ amount: value })}
                onValues={(update) => edit({ values: update(values) })}
                onCandidate={(value) => edit({ candidateId: value })}
                onBasis={(value) => edit({ basis: value })}
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
    readonly props: OfficeExceptionFormProps
    readonly isLocked: boolean
    readonly isOtherIncomplete: boolean
    readonly isBasisMissing: boolean
    readonly onApprove: () => void
    readonly isEditing: boolean
    readonly text: NonNullable<OfficeExceptionFormProps["text"]>
    readonly item: NonNullable<OfficeExceptionFormProps["item"]>
    readonly setIsEditing: (value: boolean) => void
}

const renderOfficeExceptionFormActions = ({
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
    <Cluster gap="inline">
        {item.status === "failed" ? null : (
            <Button
                intent="commit"
                isPending={props.isBusy}
                isDisabled={isLocked || isOtherIncomplete || isBasisMissing}
                onPress={onApprove}
            >
                {isEditing
                    ? text("exceptionSaveContinue")
                    : text(item.draft === null ? "exceptionApprove" : "exceptionSendDraft")}
            </Button>
        )}
        {item.status === "failed" || item.isReconcile || (item.draft === null && item.amount === null) ? null : (
            <Button intent="neutral" isDisabled={isLocked} onPress={() => setIsEditing(!isEditing)}>
                {isEditing ? text("exceptionCancelEdit") : text("exceptionEditContinue")}
            </Button>
        )}
        <Button
            intent="alternative"
            isDisabled={isLocked}
            onPress={() => props.onDecide(item.id, { ...REJECTION, decision: "rejected" })}
        >
            {text("exceptionReject")}
        </Button>
    </Cluster>
)
