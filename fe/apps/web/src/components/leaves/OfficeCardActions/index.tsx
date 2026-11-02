import { Button, Cluster, Text } from "@starci/grammar/common"
import type { OfficeResultCardView, OfficeThreadProps } from "@/modules/types"

/** What the actions of a result card draw and do. */
type OfficeCardActionsProps = {
    readonly card: OfficeResultCardView
    readonly copy: OfficeThreadProps["props"]["cardCopy"]["result"]
    readonly isBusy: boolean
    readonly isEditing: boolean
    readonly setIsEditing: (value: boolean) => void
    readonly decide: (decision: "approved" | "rejected") => void
}

/** Approve / Edit / Decline while a result card waits, and the link at its foot. */
export const OfficeCardActions = (props: OfficeCardActionsProps) => {
    const { card, copy, isBusy, isEditing } = props
    return (
        <Cluster gap="inline">
            {card.canApprove ? (
                <Button
                    intent="commit"
                    size="sm"
                    isPending={isBusy}
                    isDisabled={isBusy}
                    onPress={() => props.decide("approved")}
                >
                    {isEditing ? copy.approveEdited : copy.cardApprove}
                </Button>
            ) : null}
            {card.canEdit ? (
                <Button intent="neutral" size="sm" isDisabled={isBusy} onPress={() => props.setIsEditing(!isEditing)}>
                    {isEditing ? copy.cancelEdit : copy.edit}
                </Button>
            ) : null}
            {card.canDecline ? (
                <Button intent="alternative" size="sm" isDisabled={isBusy} onPress={() => props.decide("rejected")}>
                    {copy.cardDecline}
                </Button>
            ) : null}
            {card.link === null ? null : (
                <Button intent="neutral" size="sm" href={card.link.href}>
                    {card.link.label}
                </Button>
            )}
            {card.state === "pending" && !card.canApprove && card.refId !== null ? (
                <Text size="sm" isStrong live="polite">
                    {copy.waitingManager}
                </Text>
            ) : null}
        </Cluster>
    )
}
