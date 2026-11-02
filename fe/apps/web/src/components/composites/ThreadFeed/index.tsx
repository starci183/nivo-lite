import {
    Badge,
    Cluster,
    EmptyNotice,
    Quote,
    Stack,
    Text,
    MessageBubble,
    VerticalScrollRegion,
} from "@starci/grammar/common"
import { ThreadApprovalCard } from "@/components/branches/ThreadApprovalCard"
import { ThreadAuthorMark } from "@/components/branches/ThreadAuthorMark"
import { ThreadMentionChip } from "@/components/leaves/ThreadMentionChip"
import type { ThreadMessageView, ThreadApprovalLabels } from "@/modules/types"
import { FEED_CLASS_NAME } from "./classNames"

/** What the thread draws and asks. */
type ThreadFeedProps = {
    readonly label: string
    readonly messages: ReadonlyArray<ThreadMessageView>
    /** The messages are still loading: waiting bubbles take their place. */
    readonly isLoading: boolean
    readonly emptyMessage: string
    readonly aiLabel: string
    readonly quotedLabel: string
    readonly approvalLabels: ThreadApprovalLabels
    /** The id of the message whose card decision is being sent, or null. */
    readonly decidingId: string | null
    readonly onApprove: (messageId: string) => void
    readonly onReject: (messageId: string) => void
}

/** The messages of the open thread, oldest first, each with its chips, the customer words quoted as plain text and its approval card. */
const Messages = (props: Omit<ThreadFeedProps, "label">) => {
    if (props.isLoading) return <MessageBubble isLoading hasAvatar />
    if (props.messages.length === 0) return <EmptyNotice message={props.emptyMessage} />
    return (
        <>
            {props.messages.map((message) => (
                <MessageBubble
                    key={message.id}
                    side="incoming"
                    author={message.authorName}
                    meta={message.time}
                    avatar={
                        <ThreadAuthorMark
                            name={message.authorName}
                            glyph={message.glyph}
                            avatarUrl={message.avatarUrl}
                        />
                    }
                    status={message.isAgent ? <Badge tone="neutral">{props.aiLabel}</Badge> : undefined}
                    footer={
                        message.approval === null ? undefined : (
                            <ThreadApprovalCard
                                card={message.approval}
                                labels={props.approvalLabels}
                                isBusy={props.decidingId === message.id}
                                onApprove={props.onApprove}
                                onReject={props.onReject}
                            />
                        )
                    }
                    body={
                        <Stack gap="inline">
                            <Cluster gap="identity">
                                {message.segments.map((segment) =>
                                    segment.kind === "mention" ? (
                                        <ThreadMentionChip key={segment.offset} name={segment.name} />
                                    ) : (
                                        <Text key={segment.offset} as="span">
                                            {segment.text}
                                        </Text>
                                    ),
                                )}
                            </Cluster>
                            {message.quoted.map((quote) => (
                                <Quote key={quote} source={props.quotedLabel} text={quote} />
                            ))}
                        </Stack>
                    }
                />
            ))}
        </>
    )
}

/** The scrolling thread: the messages of the open thread, or waiting bubbles, or the empty notice. */
export const ThreadFeed = (props: ThreadFeedProps) => (
    <div className={FEED_CLASS_NAME}>
        <VerticalScrollRegion isScrollable role="log" aria-label={props.label}>
            <Stack gap="section">
                <Messages
                    messages={props.messages}
                    isLoading={props.isLoading}
                    emptyMessage={props.emptyMessage}
                    aiLabel={props.aiLabel}
                    quotedLabel={props.quotedLabel}
                    approvalLabels={props.approvalLabels}
                    decidingId={props.decidingId}
                    onApprove={props.onApprove}
                    onReject={props.onReject}
                />
            </Stack>
        </VerticalScrollRegion>
    </div>
)
