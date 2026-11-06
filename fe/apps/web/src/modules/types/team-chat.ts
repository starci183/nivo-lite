import type { DataSlot, SlotLabels } from "./slot"

/** What a person answers an approval card with. */
export type TeamChatVerdict = "approved" | "refused"

/** Who a room member, a message author or a mention is. */
export type ChatPartyKind = "user" | "agent"

/** A person or an agent the composer may mention, or the new-chat form may pick. */
export interface ChatParty {
    readonly kind: ChatPartyKind
    readonly id: string
    readonly name: string
}

/** One room of the list, with every word resolved. */
export interface TeamChatRoomRow {
    readonly id: string
    readonly kind: "direct" | "group"
    readonly title: string
    /** Who the room is with when it is direct (the mark it wears); null for a group. */
    readonly other: ChatParty | null
    /** The last message in one line (author and text), or the empty line. */
    readonly preview: string
    /** The time of the last message in the short form, or empty. */
    readonly when: string
    readonly unread: number
    readonly mentions: number
    readonly isSelected: boolean
}

/** The state of the decision a card carries. */
export type TeamChatApprovalStatus = "pending" | "approved" | "refused" | "expired"

/** The approval card of a message: one decision, the same one the workbench pane shows. */
export interface TeamChatApprovalView {
    readonly decisionId: string
    readonly status: TeamChatApprovalStatus
    /** Who settled it, empty while pending. */
    readonly decidedBy: string
    readonly decidedAt: string
    /** The viewer holds the right the decide door checks. */
    readonly canDecide: boolean
}

/** One file under a message. */
export interface TeamChatFileView {
    readonly id: string
    readonly name: string
    readonly contentType: string
    readonly url: string
}

/** One message of the open thread, with every word resolved. */
export interface TeamChatMessageRow {
    readonly id: string
    readonly kind: "text" | "report" | "approval" | "system"
    readonly side: "outgoing" | "incoming"
    readonly author: ChatParty | null
    readonly authorName: string
    readonly body: string
    readonly timeLabel: string
    /** The day it opens when it is the first of its day, else null: the thread draws a divider before it. */
    readonly dayLabel: string | null
    readonly pinned: boolean
    readonly files: ReadonlyArray<TeamChatFileView>
    /** Where the run a report belongs to opens, or null when the message is no report or its agent is gone. */
    readonly reportHref: string | null
    readonly approval: TeamChatApprovalView | null
}

/** The words and state of the team chat composer. */
export interface TeamChatComposerProps {
    readonly formLabel: string
    readonly messageLabel: string
    readonly placeholder: string
    readonly sendLabel: string
    readonly draft: string
    /** The line that says who is typing in the room, or null when nobody is. */
    readonly typing: string | null
    /** The file control of the composer. */
    readonly file: {
        readonly label: string
        readonly removeLabel: string
        readonly accept: string
        /** The name of the file that goes with the message, or null. */
        readonly name: string | null
        /** A room is open to upload to: the first message to an agent opens it, so the control waits until then. */
        readonly canPick: boolean
    }
    readonly isSending: boolean
    /** The first read is not in: the field draws as a waiting shape. */
    readonly isLoading: boolean
    /** Nothing is in flight and a room (or an agent to open one with) is there. */
    readonly canSend: boolean
    /** Why the last message was not sent, or null. */
    readonly error: { readonly title: string; readonly text: string } | null
    /** The people and agents the open `@` may name: empty when none is being typed. */
    readonly suggestions: ReadonlyArray<ChatParty>
    readonly onFile: (file: File) => void
    readonly onFileClear: () => void
    readonly onDraft: (value: string) => void
    readonly onMention: (party: ChatParty) => void
    readonly onSend: () => void
}

/** The words of the cards and controls of a thread. */
export interface TeamChatMessagesCopy {
    readonly pin: string
    readonly unpin: string
    readonly pinned: string
    readonly report: string
    readonly approvalPending: string
    readonly approvalApproved: string
    readonly approvalRefused: string
    readonly approvalExpired: string
    readonly approve: string
    readonly refuse: string
    readonly olderLabel: string
    readonly openRun: string
    /** "by {name}" and "at {time}" are composed from these parts, because module words take no placeholders. */
    readonly decidedBy: string
}

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
    readonly title: string
    readonly back: string
    readonly threadLabel: string
    readonly tabAll: string
    readonly tabPinned: string
    readonly tabsLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly threadEmpty: string
    readonly errorBody: string
    /** The head line of a group: its members, composed of the count and this word. */
    readonly members: string
    readonly mute: string
    readonly unmute: string
}

/** What the room draws, already resolved. */
export interface TeamChatRoomViewProps {
    readonly copy: TeamChatRoomCopy
    readonly labels: SlotLabels
    readonly threadSlot: DataSlot<ReadonlyArray<TeamChatMessageRow>>
    readonly isWaiting: boolean
    /** The open room, or null when none is. */
    readonly roomId: string | null
    readonly title: string
    readonly other: ChatParty | null
    readonly memberCount: number
    readonly tab: "all" | "pinned"
    /** A room is open, or the first message to an agent opens it: the thread and the composer are drawn. */
    readonly canWrite: boolean
    /** The head has a way back to the list of rooms (the page; the agent tab has none). */
    readonly canGoBack: boolean
    readonly isMuted: boolean | null
    readonly messagesCopy: TeamChatMessagesCopy
    readonly hasOlder: boolean
    readonly isLoadingOlder: boolean
    readonly decidingId: string | null
    readonly decideError: string | null
    readonly composer: Omit<TeamChatComposerProps, "onDraft" | "onMention" | "onSend" | "onFile" | "onFileClear">
}

/** What the room asks of its owner. */
export interface TeamChatRoomHandlers {
    readonly refresh: () => void
    readonly back: () => void
    readonly tab: (tab: "all" | "pinned") => void
    readonly older: () => void
    readonly pin: (messageId: string, isPinned: boolean) => void
    readonly decide: (decisionId: string, verdict: "approved" | "refused") => void
    readonly draft: (value: string) => void
    readonly mention: (party: ChatParty) => void
    readonly send: () => void
    readonly file: (file: File) => void
    readonly fileClear: () => void
    readonly toggleMute: () => void
}

/** The words of the list of rooms. */
interface TeamChatRoomsCopy {
    readonly title: string
    readonly listLabel: string
    readonly newChat: string
    readonly refresh: string
    readonly groupLine: string
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
    readonly newChat: Omit<
        TeamChatNewChatProps,
        "onOpenChange" | "onDirect" | "onGroupName" | "onGroupMembers" | "onStartDirect" | "onCreateGroup"
    >
}

/** What the list of rooms asks of its owner. */
export interface TeamChatRoomsHandlers {
    readonly refresh: () => void
    readonly select: (roomId: string) => void
    readonly openNewChat: () => void
    readonly newChatOpenChange: (isOpen: boolean) => void
    readonly newChatDirect: (value: string | null) => void
    readonly newChatGroupName: (value: string) => void
    readonly newChatGroupMembers: (value: ReadonlyArray<string>) => void
    readonly newChatStartDirect: () => void
    readonly newChatCreateGroup: () => void
}
