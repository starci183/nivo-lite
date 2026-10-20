import { useState } from "react"
import type { ReactNode } from "react"
import { Badge, Text } from "@starci/grammar/common"
import { OfficeCardActions } from "@/components/leaves/OfficeCardActions"
import { OfficeCardBody } from "@/components/leaves/OfficeCardBody"
import { OfficeCardDetails } from "@/components/leaves/OfficeCardDetails"
import { OfficeCardMedia } from "@/components/leaves/OfficeCardMedia"
import { OfficeCardFrame } from "@/components/leaves/OfficeCardFrame"
import type { OfficeResultCardView, OfficeText } from "@/modules/types"
import { STATUS_CLASS_NAME, TEXT_CLASS_NAME } from "./classNames"

/** What one agent result card draws. */
type OfficeResultCardProps = {
    readonly card: OfficeResultCardView
    readonly avatar: ReactNode
    readonly text: OfficeText
    /** True while the decision the card names is being saved. */
    readonly isBusy: boolean
    readonly onDecide: (
        kind: "execution" | "work_item",
        id: string,
        decision: "approved" | "rejected",
        edited: string | null,
    ) => void
}

const TONES = {
    pending: "warning",
    approved: "success",
    done: "success",
    declined: "danger",
    failed: "danger",
    queued: "neutral",
    info: "neutral",
} as const

/**
 * An agent result card in a Hub room (draft post, video, report, booking held, daily summary...): the agent line, then the card
 * with its fields, media and timed lines, and, while it waits, Approve / Edit / Decline through the existing decision flow.
 */
export const OfficeResultCard = (props: OfficeResultCardProps) => {
    const { card, text } = props
    const [isEditing, setIsEditing] = useState(false)
    const [draft, setDraft] = useState(card.body ?? "")
    const decide = (decision: "approved" | "rejected") => {
        if (card.refKind === null || card.refId === null) return
        const edited = decision === "approved" && isEditing && draft.trim() !== card.body ? draft.trim() : null
        props.onDecide(card.refKind, card.refId, decision, edited)
        setIsEditing(false)
    }
    return (
        <OfficeCardFrame
            id={card.anchor}
            author={card.author}
            avatar={props.avatar}
            status={card.isAi ? <Badge tone="neutral">{text("aiBadge")}</Badge> : undefined}
            meta={card.time}
            label={card.title}
            isHighlight={card.isFocused}
            head={card.lead === null ? <Text size="sm">{card.typeLabel}</Text> : <Text>{card.lead}</Text>}
        >
            <div className={TEXT_CLASS_NAME}>
                <Text weight="semibold">{card.title}</Text>
                {card.subtitle === null ? null : (
                    <Text size="sm" tone="muted">
                        {card.subtitle}
                    </Text>
                )}
            </div>
            <div className={STATUS_CLASS_NAME}>
                {card.badge === null ? null : (
                    <Badge tone={TONES[card.state]} isDot>
                        {card.badge}
                    </Badge>
                )}
                <Badge tone="neutral">{card.typeLabel}</Badge>
            </div>
            <OfficeCardBody
                card={card}
                text={text}
                isEditing={isEditing}
                draft={draft}
                setDraft={setDraft}
                isBusy={props.isBusy}
            />
            <OfficeCardMedia card={card} />
            <OfficeCardDetails card={card} text={text} />
            <OfficeCardActions
                card={card}
                text={text}
                isBusy={props.isBusy}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                decide={decide}
            />
        </OfficeCardFrame>
    )
}
