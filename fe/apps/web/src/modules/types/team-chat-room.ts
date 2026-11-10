import type { DataSlot, SlotLabels } from "./slot"
import type { ChatParty, ChatPartyKind, TeamChatComposerProps, TeamChatMessageRow, TeamChatMessagesCopy, TeamChatRoomRow } from "./team-chat"
import type { TeamChatStopHandlers } from "./team-chat-stop"

/** The words of the new-chat drawer. */
interface TeamChatNewChatCopy {
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly directTitle: string
    readonly directLabel: string
    readonly directPlaceholder: string
    readonly directStart: string
    readonly groupTitle: string
    readonly groupNameLabel: string
    readonly groupMembersLabel: string
    readonly groupCreate: string
    readonly empty: string
}

/** One party the drawer offers: its key, its name and its kind in words. */
export interface NewChatOption {
    readonly id: string
    readonly label: string
    readonly description: string
}

/** What the drawer draws and holds: the form values live in the block, so the drawer stays a picture of them. */
export interface TeamChatNewChatProps {
    readonly isOpen: boolean
    readonly copy: TeamChatNewChatCopy
    /** The people and agents to pick from, with the kind each one is. */
    readonly options: ReadonlyArray<NewChatOption>
    /** The party picked for a direct room, as "kind:id", or null. */
    readonly direct: string | null
    readonly groupName: string
    /** The parties ticked for a group, as "kind:id". */
    readonly groupMembers: ReadonlyArray<string>
    readonly isPending: boolean
    readonly error: string | null
    readonly onOpenChange: (isOpen: boolean) => void
    readonly onDirect: (value: string | null) => void
    readonly onGroupName: (value: string) => void
    readonly onGroupMembers: (value: ReadonlyArray<string>) => void
    readonly onStartDirect: () => void
    readonly onCreateGroup: () => void
}

/** The words of the room. */
export interface TeamChatRoomCopy {
    readonly back: string
    readonly threadLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly threadEmpty: string
    readonly errorBody: string
    readonly mute: string
    readonly unmute: string
    /** The words of the pinned messages: the head button, the panel title and its empty line. */
    readonly pinnedOpen: string
    readonly pinnedEmpty: string
    /** The words of the members: the head button and the panel title. */
    readonly membersOpen: string
    readonly panelClose: string
}

/** The mark of the open room: the chat glyph of a group, or the avatar of the person or the agent it is with. */
export interface TeamChatMarkView {
    readonly kind: "group" | ChatPartyKind
    readonly id: string
    readonly name: string
    readonly picture: string | null
}

/** Who the open room is with, in the head: the mark, the name and the muted line under it. */
export interface TeamChatHeadView {
    readonly title: string
    readonly subtitle: string
    readonly mark: TeamChatMarkView
}

/** One member of the open room as the members panel lists it. */
export interface TeamChatMemberView {
    readonly key: string
    readonly party: ChatParty
    /** The mark the list draws before the name. */
    readonly mark: TeamChatMarkView
    /** The kind of the member in words (person, agent). */
    readonly description: string
}

/** The panel of the room that is open over the thread, and what it holds. */
export type TeamChatPanel = "pinned" | "members"

/** The panels the head opens: the pinned messages and the members. */
export interface TeamChatPanelsView {
    readonly open: TeamChatPanel | null
    readonly pinned: DataSlot<ReadonlyArray<TeamChatMessageRow>>
    readonly members: ReadonlyArray<TeamChatMemberView>
}

/** One room the forward dialog offers. */
export interface TeamChatForwardTarget {
    readonly id: string
    readonly title: string
    readonly subtitle: string
    readonly mark: TeamChatMarkView
}

/** The dialog that picks the room a message is forwarded to. */
export interface TeamChatForwardView {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly empty: string
    /** The rooms of the viewer other than the open one. */
    readonly rooms: ReadonlyArray<TeamChatForwardTarget>
    /** The room the forward is in flight to, or null. */
    readonly sendingId: string | null
    /** Why the last forward did not go, or null. */
    readonly error: string | null
}

/** What the room draws, already resolved. */
export interface TeamChatRoomViewProps {
    readonly copy: TeamChatRoomCopy
    readonly labels: SlotLabels
    readonly threadSlot: DataSlot<ReadonlyArray<TeamChatMessageRow>>
    /** Where the thread stands in its well: at the foot while it holds messages, in the middle while it holds a notice. */
    readonly threadAlign: "end" | "center"
    readonly isWaiting: boolean
    /** The open room, or the agent whose room the first message opens; null while none is. */
    readonly head: TeamChatHeadView | null
    readonly panels: TeamChatPanelsView
    /** A room is open, or the first message to an agent opens it: the thread and the composer are drawn. */
    readonly canWrite: boolean
    /** The head has a way back to the list of rooms (the page on a phone; the agent tab has none). */
    readonly canGoBack: boolean
    readonly isMuted: boolean | null
    readonly messagesCopy: TeamChatMessagesCopy
    /** Questions the owner may put to an agent in one press; empty in a room with no agent. */
    readonly askSuggestions: ReadonlyArray<string>
    readonly hasOlder: boolean
    readonly isLoadingOlder: boolean
    readonly decidingId: string | null
    readonly decideError: string | null
    /** The stop cards of runs: whether the viewer is the owner (only the owner approves a leave request) and the card in flight. */
    readonly stops: Omit<TeamChatStopHandlers, "onAction">
    readonly forward: TeamChatForwardView
    readonly composer: Omit<TeamChatComposerProps, "onDraft" | "onMention" | "onSend" | "onFile" | "onFileClear" | "onReplyClear">
}

/** What the room asks of its owner. */
export interface TeamChatRoomHandlers {
    readonly refresh: () => void
    readonly back: () => void
    readonly panel: (panel: TeamChatPanel | null) => void
    readonly older: () => void
    readonly pin: (messageId: string, isPinned: boolean) => void
    readonly react: (messageId: string, emoji: string) => void
    readonly reply: (messageId: string) => void
    readonly share: (messageId: string) => void
    readonly shareClose: () => void
    readonly shareTo: (roomId: string) => void
    readonly replyClear: () => void
    readonly decide: (decisionId: string, verdict: "approved" | "refused") => void
    readonly stop: TeamChatStopHandlers["onAction"]
    readonly draft: (value: string) => void
    readonly mention: (party: ChatParty) => void
    readonly send: () => void
    readonly file: (file: File) => void
    readonly fileClear: () => void
    readonly toggleMute: () => void
}

/** The words of the list of rooms. */
export interface TeamChatRoomsCopy {
    readonly title: string
    readonly listLabel: string
    readonly newChat: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly searchClear: string
    readonly searchEmpty: string
    readonly groupLine: string
    readonly sectionGroup: string
    readonly sectionAgent: string
    readonly sectionPerson: string
    readonly roomsEmpty: string
    readonly roomsEmptyAction: string
    readonly errorBody: string
}

/** What the list of rooms draws, already resolved. */
export interface TeamChatRoomsViewProps {
    readonly copy: TeamChatRoomsCopy
    readonly labels: SlotLabels
    readonly slot: DataSlot<ReadonlyArray<TeamChatRoomRow>>
    readonly selectedId: string | null
    readonly query: string
    readonly newChat: Omit<
        TeamChatNewChatProps,
        "onOpenChange" | "onDirect" | "onGroupName" | "onGroupMembers" | "onStartDirect" | "onCreateGroup"
    >
}

/** What the list of rooms asks of its owner. */
export interface TeamChatRoomsHandlers {
    readonly refresh: () => void
    readonly query: (value: string) => void
    readonly select: (roomId: string) => void
    readonly openNewChat: () => void
    readonly newChatOpenChange: (isOpen: boolean) => void
    readonly newChatDirect: (value: string | null) => void
    readonly newChatGroupName: (value: string) => void
    readonly newChatGroupMembers: (value: ReadonlyArray<string>) => void
    readonly newChatStartDirect: () => void
    readonly newChatCreateGroup: () => void
}

/** One connection the agent answers from, in the aside of its chat. */
export interface TeamChatAsideSource {
    readonly id: string
    readonly label: string
    readonly subline: string
    readonly logo: string | undefined
}

/** The aside of the agent chat: what the agent answers from. */
export interface TeamChatAsideView {
    readonly copy: {
        readonly title: string
        readonly empty: string
        readonly brainTitle: string
        readonly brainLine: string
        readonly footnote: string
    }
    readonly labels: SlotLabels
    readonly sources: DataSlot<ReadonlyArray<TeamChatAsideSource>>
}
