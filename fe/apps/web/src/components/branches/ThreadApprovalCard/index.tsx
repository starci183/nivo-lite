import { Badge, Button, Cluster, ListBox, Stack, Text } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
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
    if (!card.isPending) return <Text>{card.decidedLine}</Text>
    return (
        <Cluster gap="inline">
            <Button intent="alternative" isDisabled={props.isBusy} onPress={() => props.onReject(card.messageId)}>
                {props.labels.reject}
            </Button>
            <Button intent="commit" isPending={props.isBusy} onPress={() => props.onApprove(card.messageId)}>
                {props.labels.approve}
            </Button>
        </Cluster>
    )
}

/** One person who may decide: the name, the role and where their vote stands. */
const approverItemOf = (person: ThreadApprovalCardView["approvers"][number]): ListBoxItem => ({
    id: person.id,
    label: person.name,
    description: person.roleLabel,
    leading: <PersonAvatar name={person.name} size="md" />,
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
            <ListBox label={props.labels.cardLabel} selectionMode="none" items={card.approvers.map(approverItemOf)} />
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
