import type { ReactNode } from "react"
import { Drawer, IconButton, Page, Pane, PaneGrid } from "@starci/grammar/common"
import type { PageHeaderBreadcrumbs } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { TeamChatComposer } from "@/components/composites/TeamChatComposer"
import { TeamChatForward } from "@/components/composites/TeamChatForward"
import { TeamChatMembers } from "@/components/composites/TeamChatMembers"
import { ChatComposerBand } from "@/components/frames/ChatComposerBand"
import { ChatRoomHead } from "@/components/frames/ChatRoomHead"
import { ChatThreadBand } from "@/components/frames/ChatThreadBand"
import { TeamChatMessages } from "@/components/frames/TeamChatMessages"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { TeamChatRoomHandlers, TeamChatRoomViewProps } from "@/modules/types"

/** Props for the pure half of the room. */
export interface TeamChatRoomBaseProps {
    readonly props: TeamChatRoomViewProps
    readonly on: TeamChatRoomHandlers
}

/** The thread in the pink well: the messages through the slot's one status recipe, a notice centred when there are none. */
const ThreadContent = (room: TeamChatRoomBaseProps) => (
    <ChatThreadBand
        label={room.props.copy.threadLabel}
        placement={room.props.threadAlign === "center" ? "middle" : "foot"}
        isWaiting={room.props.isWaiting}
        tone="surface"
    >
        <SlotView
            slot={room.props.threadSlot}
            placeholder={[]}
            labels={{ ...room.props.labels, empty: room.props.copy.threadEmpty }}
            emptyIconSource={nivoIconSource("chat", "leading")}
            errorDescription={room.props.copy.errorBody}
            onRetry={room.on.refresh}
            render={(rows, isLoading) => (
                <TeamChatMessages
                    rows={rows}
                    copy={room.props.messagesCopy}
                    isLoading={isLoading}
                    hasOlder={room.props.hasOlder}
                    isLoadingOlder={room.props.isLoadingOlder}
                    decidingId={room.props.decidingId}
                    decideError={room.props.decideError}
                    followsNewest
                    onOlder={room.on.older}
                    onPin={room.on.pin}
                    onDecide={room.on.decide}
                    onReact={room.on.react}
                    onReply={room.on.reply}
                    onShare={room.on.share}
                />
            )}
        />
    </ChatThreadBand>
)

/** The pinned messages in a drawer: the same bubbles and cards as the thread, unpinned from here. */
const PinnedDrawer = (room: TeamChatRoomBaseProps) => (
    <Drawer
        isOpen={room.props.panels.open === "pinned"}
        onOpenChange={(isOpen) => room.on.panel(isOpen ? "pinned" : null)}
        title={room.props.copy.pinnedOpen}
        closeLabel={room.props.copy.panelClose}
        placement="right"
    >
        <SlotView
            slot={room.props.panels.pinned}
            placeholder={[]}
            labels={{ ...room.props.labels, empty: room.props.copy.pinnedEmpty }}
            emptyIconSource={nivoIconSource("saved", "leading")}
            render={(rows, isLoading) => (
                <TeamChatMessages
                    rows={rows}
                    copy={room.props.messagesCopy}
                    isLoading={isLoading}
                    hasOlder={false}
                    isLoadingOlder={false}
                    decidingId={room.props.decidingId}
                    decideError={null}
                    followsNewest={false}
                    onOlder={room.on.older}
                    onPin={room.on.pin}
                    onDecide={room.on.decide}
                    onReact={room.on.react}
                    onReply={room.on.reply}
                    onShare={room.on.share}
                />
            )}
        />
    </Drawer>
)

/** The members in a drawer. */
const MembersDrawer = (room: TeamChatRoomBaseProps) => (
    <Drawer
        isOpen={room.props.panels.open === "members"}
        onOpenChange={(isOpen) => room.on.panel(isOpen ? "members" : null)}
        title={room.props.copy.membersOpen}
        closeLabel={room.props.copy.panelClose}
        placement="right"
    >
        <TeamChatMembers label={room.props.copy.membersOpen} members={room.props.panels.members} />
    </Drawer>
)

/** The composer on the surface under the well: the suggested questions above it, then the field with its attach and send. */
const ComposerContent = (room: TeamChatRoomBaseProps) => (
    <ChatComposerBand
        isWaiting={room.props.isWaiting}
        suggestions={
            room.props.composer.draft !== "" ? [] : room.props.askSuggestions.map((question) => ({ id: question, label: question }))
        }
        onSuggest={room.on.draft}
    >
        <TeamChatComposer
            {...room.props.composer}
            onDraft={room.on.draft}
            onMention={room.on.mention}
            onSend={room.on.send}
            onFile={room.on.file}
            onFileClear={room.on.fileClear}
            onReplyClear={room.on.replyClear}
        />
        <TeamChatForward view={room.props.forward} onClose={room.on.shareClose} onPick={room.on.shareTo} />
        <PinnedDrawer {...room} />
        <MembersDrawer {...room} />
    </ChatComposerBand>
)

/** The pure half of the room and the head it draws. */
type RoomHeadProps = TeamChatRoomBaseProps & { readonly head: NonNullable<TeamChatRoomViewProps["head"]> }

/** The head of the open room: who it is with, then at the end the pinned messages, the members and the mute of it. */
const RoomHead = (room: RoomHeadProps) => (
    <ChatRoomHead
        head={room.head}
        isWaiting={room.props.isWaiting}
        {...(room.props.canGoBack ? { back: { label: room.props.copy.back, onPress: () => room.on.back() } } : {})}
    >
        <IconButton
            intent="neutral"
            source={nivoIconSource("saved", "leading")}
            label={room.props.copy.pinnedOpen}
            onPress={() => room.on.panel("pinned")}
        />
        <IconButton
            intent="neutral"
            source={nivoIconSource("community", "leading")}
            label={room.props.copy.membersOpen}
            onPress={() => room.on.panel("members")}
        />
        {room.props.isMuted === null ? null : (
            <IconButton
                intent="neutral"
                source={nivoIconSource(room.props.isMuted ? "muted" : "unmuted", "leading")}
                label={room.props.isMuted ? room.props.copy.unmute : room.props.copy.mute}
                onPress={room.on.toggleMute}
            />
        )}
    </ChatRoomHead>
)

/** What a pane draws of the room: its body (the head and the thread, or the notice that asks for a room) and its fixed footer (the composer). */
export interface TeamChatRoomParts {
    readonly body: ReactNode
    readonly footer: ReactNode | undefined
}

/**
 * The one chat room of the app, as the parts of a pane: the head on the surface (who, what the room holds, the pinned messages and the
 * members) and the thread are the body; the composer is the pane's `footer`, fixed under the thread. With no room open the body asks for one.
 */
export const teamChatRoomPartsOf = (props: TeamChatRoomBaseProps): TeamChatRoomParts => {
    const { head } = props.props
    if (!props.props.canWrite || head === null) {
        return {
            body: (
                <PaneBlank
                    message={props.props.copy.pickTitle}
                    description={props.props.copy.pickBody}
                    iconSource={nivoIconSource("chat", "leading")}
                />
            ),
            footer: undefined,
        }
    }
    return {
        body: (
            <>
                <RoomHead {...props} head={head} />
                <ThreadContent {...props} />
            </>
        ),
        footer: <ComposerContent {...props} />,
    }
}

/** The words and the parts of the panes of the chat: the trail and the rooms pane exist on the chat page, not on an agent tab. */
export interface TeamChatPanesBaseProps {
    readonly props: {
        /** The trail of the chat page, or null on an agent tab, which has its own band. */
        readonly breadcrumbs: PageHeaderBreadcrumbs | null
        readonly gridLabel: string
        readonly listLabel: string
        readonly roomLabel: string
        /** A room is open: a phone then shows the room alone. */
        readonly hasRoom: boolean
        /** The rooms pane, or null when the grid has only the room. */
        readonly list: ReactNode
        readonly parts: TeamChatRoomParts
    }
}

/** The areas of the panes: a phone shows the rooms or the open room alone; from 48rem the rooms stand beside the room. */
const gridOf = (hasList: boolean, hasRoom: boolean) =>
    hasList
        ? ({
              areas: { base: [hasRoom ? "room" : "list"], medium: ["list room"] },
              columns: { base: ["fill"], medium: ["compact", "fill"] },
          } as const)
        : ({ areas: { base: ["room"] }, columns: { base: ["fill"] } } as const)

/**
 * The room as a pane: its body is the head and the thread, its footer the composer, so only the thread scrolls. On the chat page it stands
 * beside the rooms pane under the trail; on an agent tab it is the only pane.
 */
export const TeamChatPanesBase = (page: TeamChatPanesBaseProps) => {
    const view = page.props
    const hasList = view.list !== null
    const grid = gridOf(hasList, view.hasRoom)
    const panes = (
        <PaneGrid label={view.gridLabel} areas={grid.areas} columns={grid.columns}>
            {hasList ? (
                <Pane area="list" surface label={view.listLabel}>
                    {view.list}
                </Pane>
            ) : null}
            <Pane area="room" surface content="full" label={view.roomLabel} footer={view.parts.footer}>
                {view.parts.body}
            </Pane>
        </PaneGrid>
    )
    return view.breadcrumbs === null ? (
        panes
    ) : (
        <Page chrome="panes" header={{ breadcrumbs: view.breadcrumbs }}>
            {panes}
        </Page>
    )
}
