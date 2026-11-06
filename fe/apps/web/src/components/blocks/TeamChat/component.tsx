import {
    Button,
    IconButton,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    Tabs,
} from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { TeamChatComposer } from "@/components/composites/TeamChatComposer"
import type { TeamChatComposerProps } from "@/components/composites/TeamChatComposer"
import { TeamChatMessages } from "@/components/composites/TeamChatMessages"
import type { TeamChatMessagesCopy } from "@/components/composites/TeamChatMessages"
import { TeamChatNewChat } from "@/components/composites/TeamChatNewChat"
import type { TeamChatNewChatProps } from "@/components/composites/TeamChatNewChat"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneList } from "@/components/frames/PaneList"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { ChatParty, TeamChatMessageRow, TeamChatRoomRow } from "@/modules/teamChat"
import type { DataSlot, PaneGridLayout, SlotLabels } from "@/modules/types"

/** The words of the chat surface. */
export interface TeamChatCopy {
    readonly grid: string
    readonly title: string
    readonly listLabel: string
    readonly threadLabel: string
    readonly newChat: string
    readonly refresh: string
    readonly back: string
    readonly tabAll: string
    readonly tabPinned: string
    readonly tabsLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly roomsEmpty: string
    readonly roomsEmptyAction: string
    readonly threadEmpty: string
    readonly errorBody: string
    /** The head line of a group: its members, composed of the count and this word. */
    readonly members: string
    readonly openFull: string
    readonly groupLine: string
}

/** What the surface draws, already resolved. */
export interface TeamChatBaseProps {
    readonly props: {
        readonly copy: TeamChatCopy
        readonly labels: SlotLabels
        readonly roomsSlot: DataSlot<ReadonlyArray<TeamChatRoomRow>>
        readonly threadSlot: DataSlot<ReadonlyArray<TeamChatMessageRow>>
        readonly isWaiting: boolean
        readonly selectedId: string | null
        readonly selectedTitle: string
        readonly selectedOther: ChatParty | null
        readonly memberCount: number
        readonly tab: "all" | "pinned"
        /** The list column is drawn (the page); false for the one-room panel of an agent. */
        readonly hasList: boolean
        readonly grid: PaneGridLayout
        /** The one place the surface leads to full size (the panel's link to the page), or null. */
        readonly fullHref: string | null
        readonly messagesCopy: TeamChatMessagesCopy
        readonly hasOlder: boolean
        readonly isLoadingOlder: boolean
        readonly decidingId: string | null
        readonly decideError: string | null
        readonly composer: Omit<TeamChatComposerProps, "onDraft" | "onMention" | "onSend">
        readonly newChat: Omit<
            TeamChatNewChatProps,
            | "onOpenChange"
            | "onDirect"
            | "onGroupName"
            | "onGroupMembers"
            | "onStartDirect"
            | "onCreateGroup"
        > | null
    }
    readonly on: {
        readonly refresh: () => void
        readonly select: (roomId: string) => void
        readonly back: () => void
        readonly tab: (tab: "all" | "pinned") => void
        readonly older: () => void
        readonly pin: (messageId: string, pinned: boolean) => void
        readonly decide: (decisionId: string, verdict: "approved" | "refused") => void
        readonly draft: (value: string) => void
        readonly mention: (party: ChatParty) => void
        readonly send: () => void
        readonly openNewChat: () => void
        readonly openFull: () => void
        readonly newChatOpenChange: (isOpen: boolean) => void
        readonly newChatDirect: (value: string | null) => void
        readonly newChatGroupName: (value: string) => void
        readonly newChatGroupMembers: (value: ReadonlyArray<string>) => void
        readonly newChatStartDirect: () => void
        readonly newChatCreateGroup: () => void
    }
}

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

/** The mark of a room: the agent's, the person's, or the group's chat glyph. */
const markOf = (room: { readonly other: ChatParty | null; readonly title: string }) => {
    if (room.other === null) return undefined
    return room.other.kind === "agent" ? (
        <AgentMark label={room.title} seed={room.other.id} size="md" />
    ) : (
        <PersonAvatar name={room.title} seed={room.other.id} size="md" />
    )
}

/** The list rows: the name, the last line, and at the end the time over the unread count. */
const itemsOf = (rows: ReadonlyArray<TeamChatRoomRow>, copy: TeamChatCopy): ReadonlyArray<ListBoxItem> =>
    rows.map((row) => ({
        id: row.id,
        label: row.title,
        description: row.kind === "group" && row.preview === "" ? copy.groupLine : row.preview,
        descriptionLines: 1 as const,
        ...(markOf(row) === undefined ? {} : { leading: markOf(row) }),
        trailing: (
            <RowTrailing
                meta={row.when}
                {...(row.unread > 0
                    ? { badge: { label: String(row.unread), tone: row.mentions > 0 ? ("danger" as const) : ("accent" as const) } }
                    : {})}
            />
        ),
    }))

type Props = TeamChatBaseProps

/** The rooms through the slot's one status recipe: skeleton, empty notice with its action, failure band with its retry. */
const RoomsList = (props: Props) => {
    const { copy } = props.props
    return (
        <SlotView
            slot={props.props.roomsSlot}
            placeholder={PLACEHOLDER_ROWS}
            labels={props.props.labels}
            errorDescription={copy.errorBody}
            emptyDescription={copy.roomsEmpty}
            emptyIconSource={nivoIconSource("chat", "leading")}
            emptyAction={{ label: copy.roomsEmptyAction, onAction: props.on.openNewChat }}
            onRetry={props.on.refresh}
            render={(rows, isLoading) => (
                <PaneList
                    label={copy.listLabel}
                    items={itemsOf(rows, copy)}
                    selectedId={props.props.selectedId}
                    onSelect={props.on.select}
                    empty={{ message: props.props.labels.empty }}
                    isLoading={isLoading}
                />
            )}
        />
    )
}

/** The new-chat drawer, drawn inside the list band so the page stays one grid; nothing in the panel of an agent. */
const NewChat = (props: Props) =>
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

/** The thread: its messages through the slot recipe, or the notice when the room has none. */
const Thread = (props: Props) => {
    const view = props.props
    return (
        <SlotView
            slot={view.threadSlot}
            placeholder={[]}
            labels={{ ...view.labels, empty: view.copy.threadEmpty }}
            errorDescription={view.copy.errorBody}
            onRetry={props.on.refresh}
            render={(rows, isLoading) => (
                <TeamChatMessages
                    rows={rows}
                    copy={view.messagesCopy}
                    isLoading={isLoading}
                    hasOlder={view.hasOlder}
                    isLoadingOlder={view.isLoadingOlder}
                    decidingId={view.decidingId}
                    decideError={view.decideError}
                    onOlder={props.on.older}
                    onPin={props.on.pin}
                    onDecide={props.on.decide}
                />
            )}
        />
    )
}

/** The head of the open room: who it is with, how many it holds, the link to the full page when this is the panel. */
const RoomHead = (props: Props) => {
    const view = props.props
    const other = view.selectedOther
    const mark =
        other === null ? undefined : other.kind === "agent" ? (
            <AgentMark label={view.selectedTitle} seed={other.id} size="control" />
        ) : (
            <PersonAvatar name={view.selectedTitle} seed={other.id} size="md" />
        )
    return (
        <PaneHead
            title={view.selectedId === null ? view.copy.title : view.selectedTitle}
            headingLevel={1}
            {...(view.selectedId !== null && other === null
                ? { description: `${view.memberCount} ${view.copy.members}` }
                : {})}
            {...(mark === undefined ? {} : { mark })}
            {...(view.hasList ? { back: { label: view.copy.back, onPress: props.on.back } } : {})}
            isLoading={view.isWaiting}
            actions={
                <>
                    {view.fullHref === null ? null : (
                        <Button intent="neutral" size="sm" onPress={props.on.openFull}>
                            {view.copy.openFull}
                        </Button>
                    )}
                </>
            }
        />
    )
}

/** The body of the open room: the tabs of all and pinned messages over the scrolling thread. */
const RoomBody = (props: Props) => {
    const view = props.props
    return (
        <>
            <Pane area="thread">
                <PaneSection bleed="inline">
                    <Tabs
                        label={view.copy.tabsLabel}
                        selectedKey={view.tab}
                        items={[
                            { id: "all", label: view.copy.tabAll },
                            { id: "pinned", label: view.copy.tabPinned },
                        ]}
                        onSelect={(key) => props.on.tab(key === "pinned" ? "pinned" : "all")}
                        kind="filter"
                        inset="none"
                        labelVisibility="always"
                    />
                </PaneSection>
                <PaneSection
                    scroll={{ label: view.copy.threadLabel, role: "log", tone: "background", align: "end" }}
                    isLoading={view.isWaiting}
                >
                    <Thread {...props} />
                </PaneSection>
            </Pane>
            <Pane area="composer" surface>
                <PaneSection isLoading={view.isWaiting}>
                    <TeamChatComposer
                        {...view.composer}
                        onDraft={props.on.draft}
                        onMention={props.on.mention}
                        onSend={props.on.send}
                    />
                </PaneSection>
            </Pane>
        </>
    )
}

/**
 * Presentational team chat as panes: the rooms of the viewer at the left (the page), and beside them the head of the open room,
 * its thread with report and approval cards, and the composer pinned under it. A phone shows one pane at a time. The panel of an
 * agent is the same surface without the list.
 */
export const TeamChatBase = (props: TeamChatBaseProps) => {
    const view = props.props
    const { copy } = view
    const hasRoom = view.selectedId !== null || !view.hasList
    return (
        <Page chrome="panes">
            <PaneGrid label={copy.grid} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                {view.hasList ? (
                    <>
                        <Pane area="listHead" surface>
                            <PaneHead
                                title={copy.title}
                                actions={
                                    <>
                                        <Button intent="neutral" size="sm" onPress={props.on.openNewChat}>
                                            {copy.newChat}
                                        </Button>
                                        <IconButton
                                            intent="neutral"
                                            source={nivoIconSource("retry", "leading")}
                                            label={copy.refresh}
                                            onPress={props.on.refresh}
                                        />
                                    </>
                                }
                            />
                        </Pane>
                        <Pane area="list" surface scroll label={copy.listLabel}>
                            <PaneBody overlay={<NewChat {...props} />}>
                                <RoomsList {...props} />
                            </PaneBody>
                        </Pane>
                    </>
                ) : null}
                <Pane area="head" surface>
                    <RoomHead {...props} />
                </Pane>
                {hasRoom ? (
                    <RoomBody {...props} />
                ) : (
                    <Pane area="thread" label={copy.threadLabel}>
                        <PaneBlank
                            message={copy.pickTitle}
                            description={copy.pickBody}
                            iconSource={nivoIconSource("chat", "leading")}
                        />
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}

