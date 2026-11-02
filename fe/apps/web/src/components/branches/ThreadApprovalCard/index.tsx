import { Badge, Button, Cluster, Heading, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { ApprovalCountdown } from "@/components/leaves/ApprovalCountdown"
import type { ThreadApprovalCardView, ThreadApprovalLabels } from "@/modules/types"

/** What the approval card draws and asks. */
type ThreadApprovalCardProps = {
    readonly card: ThreadApprovalCardView
    readonly labels: ThreadApprovalLabels
    /** Whether this card's decision is being sent. */
    readonly isBusy: boolean
    readonly onApprove: (messageId: string) => void
    readonly onReject: (messageId: string) => void
}

/** The two decision buttons while the card waits, or how it was decided once it did. */
const Decision = (props: ThreadApprovalCardProps) => {
    const { card } = props
    if (!card.isPending) return <Badge tone={card.decidedTone}>{card.decidedLine}</Badge>
    return (
        <Cluster gap="inline">
            <Button intent="commit" size="sm" isPending={props.isBusy} onPress={() => props.onApprove(card.messageId)}>
                {props.labels.approve}
            </Button>
            <Button
                intent="alternative"
                size="sm"
                isDisabled={props.isBusy}
                onPress={() => props.onReject(card.messageId)}
            >
                {props.labels.reject}
            </Button>
        </Cluster>
    )
}

/** The approval card inside a thread message: the rule, the policy, the clock, who is tagged and who is not, and the decision. */
export const ThreadApprovalCard = (props: ThreadApprovalCardProps) => {
    const { card } = props
    return (
        <SurfaceCard label={props.labels.cardLabel} {...(card.isPending ? { state: "pending" as const } : {})}>
            <Stack gap="row">
                <Heading level={4}>{card.title}</Heading>
                <Text size="sm" tone="muted">
                    {card.ruleLine}
                </Text>
                <Cluster gap="inline" justify="between">
                    <Text size="sm">{card.policyLabel}</Text>
                    <ApprovalCountdown expiry={card.expiry} />
                </Cluster>
                <Stack gap="inline">
                    {card.approvers.map((person) => (
                        <Cluster key={person.id} gap="row" justify="between" wrap={false}>
                            <Text size="sm">{`${person.name} · ${person.roleLabel}`}</Text>
                            <Badge tone={person.tone}>{person.statusLabel}</Badge>
                        </Cluster>
                    ))}
                    {card.excluded.map((left) => (
                        <Text key={left.id} size="xs" tone="muted">
                            {left.line}
                        </Text>
                    ))}
                </Stack>
                <Decision {...props} />
                {card.fallbackLine === null ? null : (
                    <Text size="xs" tone="muted">
                        {card.fallbackLine}
                    </Text>
                )}
            </Stack>
        </SurfaceCard>
    )
}
