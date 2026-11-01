import { Badge, ChatBubble, ChatBubbleSkeletons, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import { ThreadApprovalCard } from "@/components/branches/ThreadApprovalCard"
import { ThreadAuthorMark } from "@/components/branches/ThreadAuthorMark"
import { ThreadMentionChip } from "@/components/leaves/ThreadMentionChip"
import type { ThreadMessageView, ThreadApprovalLabels } from "@/modules/types"
import { BODY_CLASS_NAME, FEED_CLASS_NAME, QUOTE_BODY_CLASS_NAME, QUOTE_CLASS_NAME } from "./classNames"

/** What the thread draws and asks. */
type ThreadFeedProps = {
    readonly label: string
    readonly messages: ReadonlyArray<ThreadMessageView>
    /** The messages are still loading: waiting bubbles take their place. */
    readonly isSkeleton: boolean
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
    if (props.isSkeleton) return <ChatBubbleSkeletons count={3} hasAvatar />
    if (props.messages.length === 0) return <EmptyNotice message={props.emptyMessage} />
    return (
        <>
            {props.messages.map((message) => (
                <ChatBubble
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
                >
                    <div className={BODY_CLASS_NAME}>
                        {message.segments.map((segment) =>
                            segment.kind === "mention" ? (
                                <ThreadMentionChip key={segment.offset} name={segment.name} />
                            ) : (
                                <Text key={segment.offset} as="span">
                                    {segment.text}
                                </Text>
                            ),
                        )}
                    </div>
                    {message.quoted.map((quote) => (
                        <div key={quote} className={QUOTE_CLASS_NAME}>
                            <SurfaceCard ariaLabel={props.quotedLabel}>
                                <div className={QUOTE_BODY_CLASS_NAME}>
                                    <Text size="xs" tone="muted">
                                        {props.quotedLabel}
                                    </Text>
                                    <Text size="sm">{quote}</Text>
                                </div>
                            </SurfaceCard>
                        </div>
                    ))}
                </ChatBubble>
            ))}
        </>
    )
}

/** The scrolling thread: the messages of the open thread, or waiting bubbles, or the empty notice. */
export const ThreadFeed = (props: ThreadFeedProps) => (
    <div className={FEED_CLASS_NAME} role="log" aria-label={props.label}>
        <Messages
            messages={props.messages}
            isSkeleton={props.isSkeleton}
            emptyMessage={props.emptyMessage}
            aiLabel={props.aiLabel}
            quotedLabel={props.quotedLabel}
            approvalLabels={props.approvalLabels}
            decidingId={props.decidingId}
            onApprove={props.onApprove}
            onReject={props.onReject}
        />
    </div>
)
