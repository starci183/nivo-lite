import { PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { TeamChatComposer } from "@/components/composites/TeamChatComposer"
import { TeamChatMessages } from "@/components/composites/TeamChatMessages"
import { TeamChatRoomHead } from "@/components/frames/TeamChatRoomHead"
import { TeamChatThread } from "@/components/frames/TeamChatThread"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { TeamChatRoomHandlers, TeamChatRoomViewProps } from "@/modules/types"

/** Props for the pure half of the room. */
export interface TeamChatRoomBaseProps {
    readonly props: TeamChatRoomViewProps
    readonly on: TeamChatRoomHandlers
}

/** The thread of the open room with its tabs; its messages through the slot's one status recipe. */
const ThreadContent = (props: TeamChatRoomBaseProps) => (
    <TeamChatThread
        copy={props.props.copy}
        isWaiting={props.props.isWaiting}
        tab={props.props.tab}
        onTab={props.on.tab}
    >
        <SlotView
            slot={props.props.threadSlot}
            placeholder={[]}
            labels={{ ...props.props.labels, empty: props.props.copy.threadEmpty }}
            errorDescription={props.props.copy.errorBody}
            onRetry={props.on.refresh}
            render={(rows, isLoading) => (
                <TeamChatMessages
                    rows={rows}
                    copy={props.props.messagesCopy}
                    isLoading={isLoading}
                    hasOlder={props.props.hasOlder}
                    isLoadingOlder={props.props.isLoadingOlder}
                    decidingId={props.props.decidingId}
                    decideError={props.props.decideError}
                    onOlder={props.on.older}
                    onPin={props.on.pin}
                    onDecide={props.on.decide}
                />
            )}
        />
    </TeamChatThread>
)

/** The composer pinned under the thread. */
const ComposerContent = (props: TeamChatRoomBaseProps) => (
    <PaneSection isLoading={props.props.isWaiting}>
        <TeamChatComposer
            {...props.props.composer}
            onDraft={props.on.draft}
            onMention={props.on.mention}
            onSend={props.on.send}
            onFile={props.on.file}
            onFileClear={props.on.fileClear}
        />
    </PaneSection>
)

/**
 * Presentational chat room, to stand in a pane: the head of the room, its thread with report and approval cards, and the composer
 * pinned under it. With no room open it asks for one.
 */
export const TeamChatRoomBase = (props: TeamChatRoomBaseProps) => {
    const view = props.props
    return (
        <>
            <TeamChatRoomHead
                copy={view.copy}
                roomId={view.roomId}
                title={view.title}
                other={view.other}
                memberCount={view.memberCount}
                isWaiting={view.isWaiting}
                canGoBack={view.canGoBack}
                isMuted={view.isMuted}
                onBack={props.on.back}
                onToggleMute={props.on.toggleMute}
            />
            {view.canWrite ? (
                <>
                    <ThreadContent {...props} />
                    <ComposerContent {...props} />
                </>
            ) : (
                <PaneBlank
                    message={view.copy.pickTitle}
                    description={view.copy.pickBody}
                    iconSource={nivoIconSource("chat", "leading")}
                />
            )}
        </>
    )
}
