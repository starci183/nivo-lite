import { draftWithMention, mentionTriggerOf } from "@/hooks/teamChat"
import type { TeamChatRoomState } from "@/hooks/teamChat"
import type { TeamChatRoomHandlers } from "./types"

/** The mention the person picked, written into the draft in place of the open `@`. */
const mentionInto = (room: TeamChatRoomState) => (party: Parameters<TeamChatRoomHandlers["mention"]>[0]) => {
    const trigger = mentionTriggerOf(room.composer.draft)
    if (trigger !== null) room.composer.setDraft(draftWithMention(room.composer.draft, trigger, party))
}

/** What the room asks of its owner, done on the state of the room; `back` leaves it for the list of rooms. */
export const roomHandlersOf = (room: TeamChatRoomState, back: () => void): TeamChatRoomHandlers => ({
    refresh: room.refresh,
    back,
    tab: room.setTab,
    older: room.thread.loadOlder,
    pin: (messageId, isPinned) => void room.cards.togglePin(messageId, isPinned),
    decide: (decisionId, verdict) => void room.cards.decide(decisionId, verdict),
    draft: room.composer.setDraft,
    mention: mentionInto(room),
    send: () => void room.composer.send(),
    file: room.composer.file.choose,
    fileClear: room.composer.file.clear,
    toggleMute: () => void room.rooms.toggleMute(),
})
