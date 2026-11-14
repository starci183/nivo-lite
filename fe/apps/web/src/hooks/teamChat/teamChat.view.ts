import type { useTranslations } from "next-intl"
import type { SlotLabels } from "@/modules/types"
import type { ChatRowWords } from "./teamChat.shared"
import type { TeamChatRoomState } from "./useTeamChatRoomState"

/** The translator of the team chat words. */
export type Words = ReturnType<typeof useTranslations<"teamChat">>

/** What the room is made of: the state of it, the words, and where it stands. */
export interface RoomViewContext {
    readonly room: TeamChatRoomState
    readonly t: Words
    /** The viewer's language. */
    readonly locale: string
    /** The shared words of every pane frame (the way back to the list). */
    readonly backLabel: string
    readonly labels: SlotLabels
    /** The clocks and pictures of the viewer's language and workspace. */
    readonly words: ChatRowWords
    /** The agent whose direct room this is (the first message to it opens the room); null on the chat page. */
    readonly agent: AgentOfRoom | null
    readonly canGoBack: boolean
}

/** The agent whose direct room the agent tab opens. */
export interface AgentOfRoom {
    readonly id: string
    readonly name: string
    readonly picture: string | null
}

/** The DOM id of the card of a leave request (set by the card from its work item), which a refused press brings into view. */
export const approvalCardIdOf = (workItemId: string): string => `stop-approval-${workItemId}`
