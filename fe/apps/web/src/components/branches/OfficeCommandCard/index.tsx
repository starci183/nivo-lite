import { Alert, Badge, Button, Cluster, DescriptionList, Text } from "@starci/grammar/common"
import type { OfficeCommandView, OfficeThreadProps } from "@/modules/types"

/** What the confirm card of a command draws. */
type OfficeCommandCardProps = {
    /** The card; null while NIVO is still reading the message (the card is a skeleton). */
    readonly command: OfficeCommandView | null
    /** The agent the command is for, for the card's name. */
    readonly agent: string
    readonly copy: OfficeThreadProps["props"]["cardCopy"]["command"]
    readonly gateNote: string
    readonly isBusy: boolean
    readonly onSend: (id: string) => void
    readonly onCancel: (id: string) => void
}

const STATUS_TONES = { pending: "warning", sent: "success", cancelled: "neutral" } as const

const STATUS_KEYS = { pending: "cmdPending", sent: "cmdSentBadge", cancelled: "cmdCancelledBadge" } as const

/**
 * The confirm card under an owner's "@agent ..." message: which agent, what command, the fields NIVO filled, then two separate
 * buttons. Sending hands the command to the receiving agent, which still applies its own approval rule.
 */
export const OfficeCommandCard = (props: OfficeCommandCardProps) => {
    const { command, copy } = props
    const isLoading = command === null
    const status = command?.status ?? "pending"
    const rows = [
        { id: "agent", term: copy.cmdRowAgent, description: <Text isStrong>{props.agent}</Text> },
        {
            id: "command",
            term: copy.cmdRowCommand,
            description: <Text isStrong>{command?.what ?? ""}</Text>,
        },
        ...(command?.rows ?? []).map((row) => ({
            id: row.key,
            term: row.label,
            description: <Text isStrong>{row.value}</Text>,
        })),
    ]
    return (
        <>
            <div>
                <Badge tone={STATUS_TONES[status]} isDot isLoading={isLoading}>
                    {copy[STATUS_KEYS[status]]}
                </Badge>
            </div>
            <DescriptionList layout="columns" isDivided isLoading={isLoading} items={rows} />
            <Text size="xs" tone="muted" isLoading={isLoading} live="polite">
                {command?.note ?? props.gateNote}
            </Text>
            {command?.detail === undefined || command.detail === null ? null : (
                <Alert tone="negative" title={copy.cmdFailed} description={command.detail} />
            )}
            {isLoading || status === "pending" ? (
                <Cluster gap="inline">
                    <Button
                        intent="neutral"
                        size="sm"
                        isLoading={isLoading}
                        isDisabled={isLoading || props.isBusy}
                        onPress={() => command !== null && props.onCancel(command.id)}
                    >
                        {copy.cmdCancel}
                    </Button>
                    <Button
                        intent="commit"
                        size="sm"
                        isLoading={isLoading}
                        isPending={props.isBusy}
                        isDisabled={isLoading || props.isBusy}
                        onPress={() => command !== null && props.onSend(command.id)}
                    >
                        {copy.cmdSend}
                    </Button>
                </Cluster>
            ) : null}
            {command?.workHref === undefined || command.workHref === null ? null : (
                <Cluster gap="inline">
                    <Button intent="neutral" size="sm" href={command.workHref}>
                        {copy.cmdOpenWork}
                    </Button>
                </Cluster>
            )}
        </>
    )
}
