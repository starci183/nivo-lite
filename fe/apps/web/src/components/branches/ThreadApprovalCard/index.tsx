import { useState } from "react"
import { Badge, Cluster, Inset, ListBox, Stack, Text } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { DecisionButtons } from "@/components/leaves/DecisionButtons"
import { ApprovalCountdown } from "@/components/leaves/ApprovalCountdown"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { ThreadApprovalCardView, ThreadApprovalLabels } from "@/modules/types"

/** What the approval card draws and asks. */
interface ThreadApprovalCardProps {
    readonly card: ThreadApprovalCardView
    readonly labels: ThreadApprovalLabels
    /** Whether this card's decision is being sent. */
    readonly isBusy: boolean
    readonly onApprove: (messageId: string) => void
    readonly onReject: (messageId: string) => void
}

/** The two decision buttons while the card waits (the refusal first, the approval last), or how it was decided once it was. */
const Decision = (props: ThreadApprovalCardProps) => {
    const { card } = props
    // The button pressed last is the one in flight: the spinner lands on it, not on the other.
    const [pressed, setPressed] = useState<"approve" | "reject">("approve")
    if (!card.isPending) return <Text>{card.decidedLine}</Text>
    return (
        <DecisionButtons
            size="sm"
            pending={props.isBusy ? pressed : null}
            reject={{
                label: props.labels.reject,
                onPress: () => {
                    setPressed("reject")
                    props.onReject(card.messageId)
                },
            }}
            approve={{
                label: props.labels.approve,
                onPress: () => {
                    setPressed("approve")
                    props.onApprove(card.messageId)
                },
            }}
        />
    )
}

/** One person who may decide: the name, the role and where their vote stands. */
const approverItemOf = (person: ThreadApprovalCardView["approvers"][number]): ListBoxItem => ({
    id: person.id,
    label: person.name,
    description: person.roleLabel,
    leading: <PersonAvatar name={person.name} size="sm" />,
    trailing: <Badge tone={person.tone}>{person.statusLabel}</Badge>,
})

/**
 * The approval of a message, inside its bubble: where it stands, what is asked and by which rule, the clock, the people who may
 * decide and those left out, and the decision.
 */
export const ThreadApprovalCard = (props: ThreadApprovalCardProps) => {
    const { card } = props
    return (
        <Stack gap="row">
            <Badge tone={card.decidedTone} isDot>
                {card.statusLabel}
            </Badge>
            <Stack gap="identity">
                <Text size="sm" isStrong>
                    {card.title}
                </Text>
                <Text size="xs" tone="muted">
                    {card.ruleLine}
                </Text>
            </Stack>
            <Cluster gap="inline" justify="between">
                <Text size="sm">{card.policyLabel}</Text>
                <ApprovalCountdown expiry={card.expiry} />
            </Cluster>
            <Inset>
                <ListBox
                    label={props.labels.cardLabel}
                    size="sm"
                    selectionMode="none"
                    items={card.approvers.map(approverItemOf)}
                />
            </Inset>
            {card.excluded.map((left) => (
                <Text key={left.id} size="xs" tone="muted">
                    {left.line}
                </Text>
            ))}
            {card.fallbackLine === null ? null : (
                <Text size="xs" tone="muted">
                    {card.fallbackLine}
                </Text>
            )}
            <Decision {...props} />
        </Stack>
    )
}
