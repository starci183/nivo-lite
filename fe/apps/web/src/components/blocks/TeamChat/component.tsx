import { Button, IconButton, Page, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { TeamChatComposer } from "@/components/composites/TeamChatComposer"
import { TeamChatMessages } from "@/components/composites/TeamChatMessages"
import { TeamChatNewChat } from "@/components/composites/TeamChatNewChat"
import { TeamChatRoomHead } from "@/components/frames/TeamChatRoomHead"
import { TeamChatRoomList } from "@/components/frames/TeamChatRoomList"
import { TeamChatThread } from "@/components/frames/TeamChatThread"
import { PaneBody } from "@/components/frames/PaneBody"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { TeamChatBaseProps } from "./types"
import type { TeamChatRoomRow } from "@/modules/types"

/** The new-chat drawer, drawn inside the list band so the page stays one grid; nothing in the panel of an agent. */
const NewChat = (props: TeamChatBaseProps) =>
    props.props.newChat === null ? null : (
        <TeamChatNewChat
            {...props.props.newChat}
            onOpenChange={props.on.newChatOpenChange}
            onDirect={props.on.newChatDirect}
            onGroupName={props.on.newChatGroupName}
            onGroupMembers={props.on.newChatGroupMembers}
            onStartDirect={props.on.newChatStartDirect}
            onCreateGroup={props.on.newChatCreateGroup}
        />
    )

/** The skeleton of the room list keeps the geometry of the ready rows. */
const PLACEHOLDER_ROWS: ReadonlyArray<TeamChatRoomRow> = ["a", "b", "c", "d"].map((id) => ({
    id,
    kind: "group",
    title: "",
    other: null,
    preview: "",
    when: "",
    unread: 0,
    mentions: 0,
    isSelected: false,
}))

/** The rooms through the slot's one status recipe: skeleton, empty notice with its action, failure band with its retry. */
const RoomsContent = (props: TeamChatBaseProps) => (
    <SlotView
        slot={props.props.roomsSlot}
        placeholder={PLACEHOLDER_ROWS}
        labels={props.props.labels}
        errorDescription={props.props.copy.errorBody}
        emptyDescription={props.props.copy.roomsEmpty}
        emptyIconSource={nivoIconSource("chat", "leading")}
        emptyAction={{ label: props.props.copy.roomsEmptyAction, onAction: props.on.openNewChat }}
        onRetry={props.on.refresh}
        render={(rows, isLoading) => (
            <TeamChatRoomList
                rows={rows}
                isLoading={isLoading}
                copy={props.props.copy}
                selectedId={props.props.selectedId}
                onSelect={props.on.select}
            />
        )}
    />
)

/** The thread of the open room with its tabs; its messages through the slot's one status recipe. */
const ThreadContent = (props: TeamChatBaseProps) => (
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
const ComposerContent = (props: TeamChatBaseProps) => (
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

/** The head band of the list column: its title, the way to start a chat and to read the rooms again. */
const ListHead = (props: TeamChatBaseProps) => (
    <PaneHead
        title={props.props.copy.title}
        actions={
            <>
                <Button intent="neutral" onPress={props.on.openNewChat}>
                    {props.props.copy.newChat}
                </Button>
                <IconButton
                    intent="neutral"
                    source={nivoIconSource("retry", "leading")}
                    label={props.props.copy.refresh}
                    onPress={props.on.refresh}
                />
            </>
        }
    />
)

/**
 * Presentational team chat as panes: the rooms of the viewer at the left (the page), and beside them the head of the open room,
 * its thread with report and approval cards, and the composer pinned under it. A phone shows one pane at a time. The panel of an
 * agent is the same surface without the list.
 */
export const TeamChatBase = (props: TeamChatBaseProps) => {
    const view = props.props
    const { copy } = view
    const hasRoom = view.canWrite
    return (
        <Page chrome="panes">
            <PaneGrid label={copy.grid} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                <Pane area="listHead" surface>
                    <ListHead {...props} />
                </Pane>
                <Pane area="list" surface scroll label={copy.listLabel}>
                    <PaneBody overlay={<NewChat {...props} />}>
                        <RoomsContent {...props} />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    <TeamChatRoomHead
                        copy={copy}
                        roomId={view.selectedId}
                        title={view.selectedTitle}
                        other={view.selectedOther}
                        memberCount={view.memberCount}
                        isWaiting={view.isWaiting}
                        isMuted={view.isMuted}
                        onBack={props.on.back}
                        onToggleMute={props.on.toggleMute}
                    />
                </Pane>
                <Pane area="thread" label={copy.threadLabel}>
                    {hasRoom ? (
                        <ThreadContent {...props} />
                    ) : (
                        <PaneBlank
                            message={copy.pickTitle}
                            description={copy.pickBody}
                            iconSource={nivoIconSource("chat", "leading")}
                        />
                    )}
                </Pane>
                {hasRoom ? (
                    <Pane area="composer" surface>
                        <ComposerContent {...props} />
                    </Pane>
                ) : null}
            </PaneGrid>
        </Page>
    )
}
