import type { TeamChatComposerProps } from "@/components/composites/TeamChatComposer"
import type { TeamChatMessagesCopy } from "@/components/composites/TeamChatMessages"
import type { ChatParty, DataSlot, SlotLabels, TeamChatMessageRow } from "@/modules/types"

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

/** Props for the pure half of the room. */
export interface TeamChatRoomBaseProps {
    readonly props: TeamChatRoomViewProps
    readonly on: TeamChatRoomHandlers
}
