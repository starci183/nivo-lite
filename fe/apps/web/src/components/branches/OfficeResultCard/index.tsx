import type { ReactNode } from "react"
import { Badge, Cluster, Stack, Text } from "@starci/grammar/common"
import { OfficeCardActions } from "@/components/leaves/OfficeCardActions"
import { OfficeCardBody } from "@/components/leaves/OfficeCardBody"
import { OfficeCardDetails } from "@/components/leaves/OfficeCardDetails"
import { OfficeCardMedia } from "@/components/leaves/OfficeCardMedia"
import { OfficeCardFrame } from "@/components/leaves/OfficeCardFrame"
import type { OfficeCardDraft, OfficeResultCardView, OfficeText } from "@/modules/types"

/** What one agent result card draws. */
type OfficeResultCardProps = {
    readonly card: OfficeResultCardView
    readonly avatar: ReactNode
    readonly text: OfficeText
    /** What the owner edited on this card, kept by the thread's block. */
    readonly draft: OfficeCardDraft
    readonly onEdit: (key: string, patch: Partial<OfficeCardDraft>) => void
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
    const { isEditing } = props.draft
    const draft = props.draft.text ?? card.body ?? ""
    const edit = (patch: Partial<OfficeCardDraft>) => props.onEdit(card.key, patch)
    const decide = (decision: "approved" | "rejected") => {
        if (card.refKind === null || card.refId === null) return
        const edited = decision === "approved" && isEditing && draft.trim() !== card.body ? draft.trim() : null
        props.onDecide(card.refKind, card.refId, decision, edited)
        edit({ isEditing: false })
    }
    return (
        <OfficeCardFrame
            identity={card}
            aiLabel={text("aiBadge")}
            avatar={props.avatar}
            head={card.lead === null ? <Text size="sm">{card.typeLabel}</Text> : <Text>{card.lead}</Text>}
        >
            <Stack gap="identity">
                <Text weight="semibold">{card.title}</Text>
                {card.subtitle === null ? null : (
                    <Text size="sm" tone="muted">
                        {card.subtitle}
                    </Text>
                )}
            </Stack>
            <Cluster gap="inline">
                {card.badge === null ? null : (
                    <Badge tone={TONES[card.state]} isDot>
                        {card.badge}
                    </Badge>
                )}
                <Badge tone="neutral">{card.typeLabel}</Badge>
            </Cluster>
            <OfficeCardBody
                card={card}
                text={text}
                isEditing={isEditing}
                draft={draft}
                setDraft={(value) => edit({ text: value })}
                isBusy={props.isBusy}
            />
            <OfficeCardMedia card={card} />
            <OfficeCardDetails card={card} text={text} />
            <OfficeCardActions
                card={card}
                text={text}
                isBusy={props.isBusy}
                isEditing={isEditing}
                setIsEditing={(value) => edit({ isEditing: value })}
                decide={decide}
            />
        </OfficeCardFrame>
    )
}
