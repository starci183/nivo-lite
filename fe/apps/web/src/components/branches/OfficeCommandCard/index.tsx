import type { ReactNode } from "react"
import { Alert, Badge, Button, Cluster, DescriptionList, Text } from "@starci/grammar/common"
import { OfficeCardFrame } from "@/components/leaves/OfficeCardFrame"
import type { OfficeCommandView, OfficeText } from "@/modules/types"

/** What the confirm card of a command draws. */
type OfficeCommandCardProps = {
    /** The card; null while NIVO is still reading the message (the card is a skeleton). */
    readonly command: OfficeCommandView | null
    /** The line of the bubble: the question, or "NIVO is reading..." for the skeleton. */
    readonly ask: string
    /** The agent the command is for, for the card's name. */
    readonly agent: string
    readonly avatar: ReactNode
    readonly text: OfficeText
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
    const { command, text } = props
    const isSkeleton = command === null
    const status = command?.status ?? "pending"
    const rows = [
        { id: "agent", term: text("cmdRowAgent"), description: <Text weight="medium">{props.agent}</Text> },
        {
            id: "command",
            term: text("cmdRowCommand"),
            description: <Text weight="medium">{command?.what ?? ""}</Text>,
        },
        ...(command?.rows ?? []).map((row) => ({
            id: row.key,
            term: row.label,
            description: <Text weight="medium">{row.value}</Text>,
        })),
    ]
    return (
        <OfficeCardFrame
            id={command?.anchor}
            author={text("nivoCore")}
            avatar={props.avatar}
            label={text("cmdCardLabel", { agent: props.agent })}
            head={
                <Text as="p" isSkeleton={isSkeleton}>
                    {props.ask}
                </Text>
            }
        >
            <div>
                <Badge tone={STATUS_TONES[status]} isDot isSkeleton={isSkeleton}>
                    {text(STATUS_KEYS[status])}
                </Badge>
            </div>
            <DescriptionList layout="columns" isDivided isLoading={isSkeleton} items={rows} />
            <Text size="xs" tone="muted" isSkeleton={isSkeleton} live="polite">
                {command?.note ?? text("cmdGateNote", { agent: props.agent })}
            </Text>
            {command?.detail === undefined || command.detail === null ? null : (
                <Alert tone="negative" title={text("cmdFailed")} description={command.detail} />
            )}
            {isSkeleton || status === "pending" ? (
                <Cluster gap="inline">
                    <Button
                        intent="neutral"
                        size="sm"
                        isSkeleton={isSkeleton}
                        isDisabled={isSkeleton || props.isBusy}
                        onPress={() => command !== null && props.onCancel(command.id)}
                    >
                        {text("cmdCancel")}
                    </Button>
                    <Button
                        intent="commit"
                        size="sm"
                        isSkeleton={isSkeleton}
                        isPending={props.isBusy}
                        isDisabled={isSkeleton || props.isBusy}
                        onPress={() => command !== null && props.onSend(command.id)}
                    >
                        {text("cmdSend")}
                    </Button>
                </Cluster>
            ) : null}
            {command?.workHref === undefined || command.workHref === null ? null : (
                <Cluster gap="inline">
                    <Button intent="neutral" size="sm" href={command.workHref}>
                        {text("cmdOpenWork")}
                    </Button>
                </Cluster>
            )}
        </OfficeCardFrame>
    )
}
