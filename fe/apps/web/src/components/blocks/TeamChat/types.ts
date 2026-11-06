import type { TeamChatComposerProps } from "@/components/composites/TeamChatComposer"
import type { TeamChatMessagesCopy } from "@/components/composites/TeamChatMessages"
import type { TeamChatNewChatProps } from "@/components/composites/TeamChatNewChat"
import type {
    ChatParty,
    DataSlot,
    PaneGridLayout,
    SlotLabels,
    TeamChatMessageRow,
    TeamChatRoomRow,
} from "@/modules/types"

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
    readonly mute: string
    readonly unmute: string
    readonly groupLine: string
}

/** What the surface draws, already resolved. */
export interface TeamChatViewProps {
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
    readonly grid: PaneGridLayout
    readonly messagesCopy: TeamChatMessagesCopy
    readonly hasOlder: boolean
    readonly isLoadingOlder: boolean
    readonly decidingId: string | null
    readonly decideError: string | null
    readonly composer: Omit<TeamChatComposerProps, "onDraft" | "onMention" | "onSend" | "onFile" | "onFileClear">
    /** The viewer muted the open room; null when no room is open. */
    readonly isMuted: boolean | null
    /** A room is open, or the page is opened on an agent: the thread and the composer are drawn. */
    readonly canWrite: boolean
    readonly newChat: Omit<
        TeamChatNewChatProps,
        "onOpenChange" | "onDirect" | "onGroupName" | "onGroupMembers" | "onStartDirect" | "onCreateGroup"
    > | null
}

/** What the surface asks of its owner. */
export interface TeamChatHandlers {
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
    readonly file: (file: File) => void
    readonly fileClear: () => void
    readonly toggleMute: () => void
    readonly openNewChat: () => void
    readonly newChatOpenChange: (isOpen: boolean) => void
    readonly newChatDirect: (value: string | null) => void
    readonly newChatGroupName: (value: string) => void
    readonly newChatGroupMembers: (value: ReadonlyArray<string>) => void
    readonly newChatStartDirect: () => void
    readonly newChatCreateGroup: () => void
}

/** Props for the pure half of the team chat. */
export interface TeamChatBaseProps {
    readonly props: TeamChatViewProps
    readonly on: TeamChatHandlers
}
