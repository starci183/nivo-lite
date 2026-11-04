import { Badge, Cluster, EmptyNotice, MessageBubble, Quote, Stack, Text } from "@starci/grammar/common"
import { ThreadApprovalCard } from "@/components/branches/ThreadApprovalCard"
import { ThreadAuthorMark } from "@/components/branches/ThreadAuthorMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { ThreadMentionChip } from "@/components/leaves/ThreadMentionChip"
import type { ThreadApprovalLabels, ThreadMessageView } from "@/modules/types"

/** What the thread draws and asks. */
interface ThreadFeedProps {
    readonly messages: ReadonlyArray<ThreadMessageView>
    /** The messages are still loading: each bubble draws as its own skeleton. */
    readonly isLoading: boolean
    readonly emptyTitle: string
    readonly emptyMessage: string
    readonly aiLabel: string
    readonly quotedLabel: string
    readonly approvalLabels: ThreadApprovalLabels
    /** The id of the message whose card decision is being sent, or null. */
    readonly decidingId: string | null
    readonly onApprove: (messageId: string) => void
    readonly onReject: (messageId: string) => void
}

/** What one message draws: its view and the words and commands of the thread around it. */
interface MessageProps extends Omit<ThreadFeedProps, "messages" | "emptyTitle" | "emptyMessage"> {
    readonly message: ThreadMessageView
}

/** What the words of a message draw. */
interface BodyProps {
    readonly message: ThreadMessageView
    readonly quotedLabel: string
}

/** The words of a message: the text with the chips of whom it tags, and the customer words quoted as plain text. */
const Body = (props: BodyProps) => (
    <Stack gap="inline">
        <Cluster gap="identity">
            {props.message.segments.map((segment) =>
                segment.kind === "mention" ? (
                    <ThreadMentionChip key={segment.offset} name={segment.name} />
                ) : (
                    <Text key={segment.offset} as="span">
                        {segment.text}
                    </Text>
                ),
            )}
        </Cluster>
        {props.message.quoted.map((quote) => (
            <Quote key={quote} source={props.quotedLabel} text={quote} />
        ))}
    </Stack>
)

/** One message of the thread with its author, time and chips, and its approval card when it carries one. */
const Message = (props: MessageProps) => {
    const { message } = props
    return (
        <MessageBubble
            side="incoming"
            author={message.authorName}
            meta={message.time}
            isLoading={props.isLoading}
            avatar={<ThreadAuthorMark name={message.authorName} glyph={message.glyph} avatarUrl={message.avatarUrl} />}
            status={message.isAgent ? <Badge tone="neutral">{props.aiLabel}</Badge> : undefined}
            body={
                <Stack gap="row">
                    <Body message={message} quotedLabel={props.quotedLabel} />
                    {message.approval === null ? null : (
                        <ThreadApprovalCard
                            card={message.approval}
                            labels={props.approvalLabels}
                            isBusy={props.decidingId === message.id}
                            onApprove={props.onApprove}
                            onReject={props.onReject}
                        />
                    )}
                </Stack>
            }
        />
    )
}

/** The messages of the open thread, oldest first; the invitation to tag someone when it has none. */
export const ThreadFeed = (props: ThreadFeedProps) => {
    if (props.messages.length === 0) {
        return (
            <EmptyNotice
                message={props.emptyTitle}
                description={props.emptyMessage}
                iconSource={nivoIconSource("mention", "leading")}
            />
        )
    }
    return (
        <Stack gap="section">
            {props.messages.map((message) => (
                <Message
                    key={message.id}
                    message={message}
                    isLoading={props.isLoading}
                    aiLabel={props.aiLabel}
                    quotedLabel={props.quotedLabel}
                    approvalLabels={props.approvalLabels}
                    decidingId={props.decidingId}
                    onApprove={props.onApprove}
                    onReject={props.onReject}
                />
            ))}
        </Stack>
    )
}
