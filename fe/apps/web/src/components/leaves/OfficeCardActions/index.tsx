import { Button, Text } from "@starci/grammar/common"
import type { OfficeResultCardView, OfficeText } from "@/modules/types"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** What the actions of a result card draw and do. */
type OfficeCardActionsProps = {
    readonly card: OfficeResultCardView
    readonly text: OfficeText
    readonly isBusy: boolean
    readonly isEditing: boolean
    readonly setIsEditing: (value: boolean) => void
    readonly decide: (decision: "approved" | "rejected") => void
}

/** Approve / Edit / Decline while a result card waits, and the link at its foot. */
export const OfficeCardActions = (props: OfficeCardActionsProps) => {
    const { card, text, isBusy, isEditing } = props
    return (
        <div className={ACTIONS_CLASS_NAME}>
            {card.canApprove ? (
                <Button
                    variant="primary"
                    size="sm"
                    isPending={isBusy}
                    isDisabled={isBusy}
                    onPress={() => props.decide("approved")}
                >
                    {isEditing ? text("approveEdited") : text("cardApprove")}
                </Button>
            ) : null}
            {card.canEdit ? (
                <Button variant="outline" size="sm" isDisabled={isBusy} onPress={() => props.setIsEditing(!isEditing)}>
                    {isEditing ? text("cancelEdit") : text("edit")}
                </Button>
            ) : null}
            {card.canDecline ? (
                <Button variant="ghost" size="sm" isDisabled={isBusy} onPress={() => props.decide("rejected")}>
                    {text("cardDecline")}
                </Button>
            ) : null}
            {card.link === null ? null : (
                <Button variant="ghost" size="sm" href={card.link.href}>
                    {card.link.label}
                </Button>
            )}
            {card.state === "pending" && !card.canApprove && card.refId !== null ? (
                <Text size="sm" weight="medium" live="polite">
                    {text("waitingManager")}
                </Text>
            ) : null}
        </div>
    )
}
