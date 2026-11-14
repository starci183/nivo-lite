import type { ReactNode } from "react"
import { Badge, Cluster, IconButton, MessageBubble, Quote, Stack } from "@starci/grammar/common"
import { ChatMessageFiles } from "@/components/leaves/ChatMessageFiles"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { chatMarkOf } from "@/modules/teamChat"
import { bubbleReactionPropsOf } from "@/components/leaves/MessageReactionProps"
import type { MessageReactionActions, TeamChatMessageRow, TeamChatMessagesCopy } from "@/modules/types"

/** One message of a person and what may be done with it. */
interface TeamChatBubbleProps extends MessageReactionActions {
    readonly row: TeamChatMessageRow
    readonly copy: Pick<TeamChatMessagesCopy, "pin" | "unpin" | "pinned" | "reactions">
    /** Pins a message; a thread with nothing to pin draws no pin. */
    readonly onPin: ((messageId: string, pinned: boolean) => void) | undefined
}

/** The mark beside an incoming bubble: the agent's picture or the person's avatar. */
const markOf = (row: TeamChatMessageRow) => <ChatPartyMark size="sm" mark={chatMarkOf(row)} />

/** What the bubble holds: the words, under the quote of the message they answer, or as a quote of whose words they were when forwarded. */
const bodyOf = (row: TeamChatMessageRow, copy: TeamChatBubbleProps["copy"]): ReactNode => {
    if (row.forwardedFrom !== null) {
        const source =
            row.forwardedFrom === "" ? copy.reactions.forwardedUnknown : copy.reactions.forwarded(row.forwardedFrom)
        return <Quote source={source} text={row.body} />
    }
    if (row.replyTo === null) return row.body
    return (
        <Stack gap="inline">
            <Quote source={copy.reactions.repliedTo(row.replyTo.authorName)} text={row.replyTo.body} />
            {row.body}
        </Stack>
    )
}

/**
 * One message in the thread. The reader's own sits at the end in the primary bubble, everyone else's at the start in the white one
 * with their mark and name; the time is muted after the name; the pin is the one tool of the message toolbar, shown on hover. The
 * hover toolbar reacts, replies and forwards, the pill shows the reactions, and a run from one sender joins its corners.
 */
export const TeamChatBubble = (props: TeamChatBubbleProps) => {
    const { row, onPin } = props
    const isOwn = row.side === "outgoing"
    return (
        <MessageBubble
            id={`message-${row.id}`}
            side={row.side}
            measure="wide"
            actionsPlacement="inline"
            author={isOwn ? undefined : row.authorName}
            avatar={isOwn ? undefined : markOf(row)}
            meta={row.timeLabel}
            status={
                row.pinned ? (
                    <Cluster gap="inline">
                        <Badge tone="neutral">{props.copy.pinned}</Badge>
                    </Cluster>
                ) : undefined
            }
            actions={
                onPin === undefined ? undefined : (
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("saved", "leading")}
                        label={row.pinned ? props.copy.unpin : props.copy.pin}
                        onPress={() => onPin(row.id, row.pinned)}
                    />
                )
            }
            footer={row.files.length === 0 ? undefined : <ChatMessageFiles files={row.files} />}
            body={bodyOf(row, props.copy)}
            {...bubbleReactionPropsOf(row, props.copy.reactions, props)}
        />
    )
}
