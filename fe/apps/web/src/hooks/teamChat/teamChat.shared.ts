import type { useQueryChatMessagesSwr, useQueryChatRoomsSwr } from "@/hooks/swr"
import { daysAgoOf, draftWithMention, mentionTriggerOf } from "@/modules/teamChat"
import type {
    ChatParty,
    ChatPartyKind,
    TeamChatMessagesCopy,
    TeamChatRoomHandlers,
    TeamChatRoomRow,
} from "@/modules/types"
import type { TeamChatRoomState } from "./useTeamChatRoomState"

/** One room as the door answers it. */
export type ChatRoomNode = NonNullable<ReturnType<typeof useQueryChatRoomsSwr>["data"]>[number]

/** One message as the door answers it. */
export type ChatMessageNode = NonNullable<ReturnType<typeof useQueryChatMessagesSwr>["data"]>[number]["nodes"][number]

/** The words and clocks a row needs, bound to the viewer's language by the hook. */
export interface ChatRowWords {
    readonly now: Date
    readonly timeOf: (iso: string) => string
    readonly dateOf: (iso: string) => string
    readonly dateWithYearOf: (iso: string) => string
    readonly today: string
    readonly yesterday: string
    readonly noMessage: string
    readonly attachment: string
    /** The word for the viewer in a preview line. */
    readonly you: string
    /** The picture the owner gave the agent of this name, or null (the NIVO mascot). */
    readonly pictureOf: (name: string) => string | null
    /** The words of the agent cards of a thread. */
    readonly copy: TeamChatMessagesCopy
    /** A path of the workspace as the address that opens it. */
    readonly hrefOf: (path: string) => string
}

/** The kind of a party from the door's enum. */
const partyKindOf = (kind: string): ChatPartyKind => (kind === "agent" ? "agent" : "user")

/** The party a member or an author is; an agent wears the picture the owner gave it. */
export const partyOf = (kind: string, id: string, name: string, words?: ChatRowWords): ChatParty => {
    const partyKind = partyKindOf(kind)
    return partyKind === "agent" && words !== undefined
        ? { kind: partyKind, id, name, picture: words.pictureOf(name) }
        : { kind: partyKind, id, name }
}

/** The members of a room as parties, the viewer left out: who the composer may mention. */
export const partiesOf = (room: ChatRoomNode | undefined, viewerId: string): ReadonlyArray<ChatParty> =>
    (room?.members ?? [])
        .filter((member) => !(member.memberKind === "user" && member.memberId === viewerId))
        .map((member) => partyOf(member.memberKind, member.memberId, member.name))

/** The time of the last message of a room in the short form: the clock today, "yesterday", else the date. */
const whenOf = (iso: string, words: ChatRowWords): string => {
    const days = daysAgoOf(iso, words.now)
    if (days <= 0) return words.timeOf(iso)
    return days === 1 ? words.yesterday : words.dateOf(iso)
}

/** One line of the last message: the author and the first words of it (a file-only message says it carries a file). */
const previewOf = (room: ChatRoomNode, words: ChatRowWords, viewerId: string): string => {
    const last = room.lastMessage
    if (last === null) return words.noMessage
    const text = last.body.trim() === "" ? words.attachment : last.body.replaceAll(/\s+/gu, " ").trim()
    if (last.authorKind === "system") return text
    const viewer = room.members.find((entry) => entry.memberKind === "user" && entry.memberId === viewerId)
    const author = viewer?.name === last.authorName ? words.you : last.authorName
    return `${author}: ${text}`
}

/** The other party of a direct room: the member that is not the viewer; none for a group. */
export const otherPartyOf = (room: ChatRoomNode, viewerId: string, words?: ChatRowWords): ChatParty | null => {
    if (room.kind !== "direct") return null
    const member = room.members.find((entry) => !(entry.memberKind === "user" && entry.memberId === viewerId))
    return member === undefined ? null : partyOf(member.memberKind, member.memberId, member.name, words)
}

/** The room rows of the list, the open one marked. */
export const roomRowsOf = (
    rooms: ReadonlyArray<ChatRoomNode>,
    selectedId: string | null,
    viewerId: string,
    words: ChatRowWords,
): ReadonlyArray<TeamChatRoomRow> =>
    rooms.map((room) => ({
        id: room.id,
        kind: room.kind === "direct" ? "direct" : "group",
        title: room.name,
        other: otherPartyOf(room, viewerId, words),
        preview: previewOf(room, words, viewerId),
        when: room.lastMessage === null ? "" : whenOf(room.lastMessage.createdAt, words),
        unread: room.unreadCount,
        mentions: room.mentionCount,
        isSelected: room.id === selectedId,
    }))


/** The longest quote of a message above the composer, in characters. */
const QUOTE_MAX = 140

/** The words of a message on one line, cut to the bound with an ellipsis: what the composer quotes. */
export const quoteOf = (body: string): string => {
    const line = body.replaceAll(/\s+/gu, " ").trim()
    return line.length <= QUOTE_MAX ? line : `${line.slice(0, QUOTE_MAX - 1)}\u2026`
}

/** The mention the person picked, written into the draft in place of the open `@`. */
const mentionInto = (room: TeamChatRoomState) => (party: Parameters<TeamChatRoomHandlers["mention"]>[0]) => {
    const trigger = mentionTriggerOf(room.composer.draft)
    if (trigger !== null) room.composer.setDraft(draftWithMention(room.composer.draft, trigger, party))
}

/** What the room asks of its owner, done on the state of the room; `back` leaves it for the list of rooms. */
export const roomHandlersOf = (room: TeamChatRoomState, back: () => void): TeamChatRoomHandlers => ({
    refresh: room.refresh,
    back,
    panel: room.setPanel,
    older: room.thread.loadOlder,
    pin: (messageId, isPinned) => void room.cards.togglePin(messageId, isPinned),
    react: room.reactions.react,
    reply: room.setReplying,
    replyClear: () => room.setReplying(null),
    share: room.forward.open,
    shareClose: room.forward.close,
    shareTo: (roomId) => void room.forward.forwardTo(roomId),
    decide: (decisionId, verdict) => void room.cards.decide(decisionId, verdict),
    draft: room.composer.setDraft,
    mention: mentionInto(room),
    send: () => void room.composer.send(),
    file: room.composer.file.choose,
    fileClear: room.composer.file.clear,
    toggleMute: () => void room.rooms.toggleMute(),
})
