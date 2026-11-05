import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ThreadComposer } from "@/components/composites/ThreadComposer"
import type { WorkThreadBoardHandlers, WorkThreadBoardView } from "@/modules/types"
import { THREAD_FEED_SKELETON } from "@/hooks/workThreads"

/** What the composer draws and asks. */
interface ThreadComposerBodyProps {
    readonly view: WorkThreadBoardView
    readonly on: WorkThreadBoardHandlers
}

/** The composer under the thread; it waits with the thread and its draft is the reader's own text. */
export const ThreadComposerBody = (props: ThreadComposerBodyProps) => {
    const { thread } = props.view
    return (
        <SlotView
            slot={thread.slot}
            placeholder={THREAD_FEED_SKELETON}
            labels={thread.slotLabels}
            forbidden="hide"
            onRetry={props.on.retry}
            render={(_feed, isLoading) => (
                <ThreadComposer
                    label={thread.composerLabel}
                    placeholder={thread.composerPlaceholder}
                    hint={thread.composerHint}
                    mentionLabel={thread.mentionLabel}
                    sendLabel={thread.sendLabel}
                    draft={thread.draft}
                    options={thread.options}
                    isSending={thread.isSending}
                    isLoading={isLoading}
                    onDraft={props.on.draft}
                    onPick={props.on.pickMention}
                    onSend={props.on.send}
                />
            )}
        />
    )
}
