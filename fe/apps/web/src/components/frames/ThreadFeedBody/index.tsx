import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ThreadFeed } from "@/components/composites/ThreadFeed"
import type { WorkThreadBoardHandlers, WorkThreadBoardView } from "@/modules/types"
import { THREAD_FEED_SKELETON } from "@/hooks/workThreads"

/** What the thread's messages draw and ask. */
interface ThreadFeedBodyProps {
    readonly view: WorkThreadBoardView
    readonly on: WorkThreadBoardHandlers
}

/** The messages of the open thread through the slot's one status recipe. */
export const ThreadFeedBody = (props: ThreadFeedBodyProps) => {
    const { thread, labels } = props.view
    return (
        <SlotView
            slot={thread.slot}
            placeholder={THREAD_FEED_SKELETON}
            labels={thread.slotLabels}
            onRetry={props.on.retry}
            render={(feed, isLoading) => (
                <ThreadFeed
                    messages={feed.messages}
                    isLoading={isLoading}
                    emptyTitle={labels.emptyFeedTitle}
                    emptyMessage={thread.feedEmpty}
                    aiLabel={thread.aiLabel}
                    quotedLabel={thread.quotedLabel}
                    approvalLabels={thread.approvalLabels}
                    decidingId={thread.decidingId}
                    onApprove={props.on.approve}
                    onReject={props.on.reject}
                />
            )}
        />
    )
}
