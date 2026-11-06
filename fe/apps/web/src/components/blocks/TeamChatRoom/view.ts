import type { useTranslations } from "next-intl"
import { CHAT_FILE_ACCEPT, isChatRefusal, mentionTriggerOf, suggestionsOf } from "@/hooks/teamChat"
import type { TeamChatRoomState } from "@/hooks/teamChat"
import { isWaitingOf } from "@/hooks/slot"
import type { TeamChatMessagesCopy } from "@/components/composites/TeamChatMessages"
import type { DataSlot, SlotLabels, TeamChatMessageRow } from "@/modules/types"
import type { TeamChatRoomCopy, TeamChatRoomViewProps } from "./types"

/** The translator of the team chat words. */
type Words = ReturnType<typeof useTranslations<"teamChat">>

/** What the room is made of: the state of it, the words, and where it stands. */
export interface RoomViewContext {
    readonly room: TeamChatRoomState
    readonly t: Words
    /** The shared words of every pane frame (the way back to the list). */
    readonly backLabel: string
    readonly labels: SlotLabels
    /** The room is the direct room with an agent: the first message to it opens it. */
    readonly withAgent: boolean
    readonly canGoBack: boolean
}

/** The words of the room. */
const copyOf = (t: Words, backLabel: string, withAgent: boolean): TeamChatRoomCopy => ({
    title: t("title"),
    back: backLabel,
    threadLabel: t("threadLabel"),
    tabAll: t("tabAll"),
    tabPinned: t("tabPinned"),
    tabsLabel: t("tabsLabel"),
    pickTitle: t("pickTitle"),
    pickBody: t("pickBody"),
    threadEmpty: withAgent ? t("agentThreadEmpty") : t("threadEmpty"),
    errorBody: t("errorBody"),
    members: t("members"),
    mute: t("mute"),
    unmute: t("unmute"),
})

/** The words of the cards and controls of a thread. */
const messagesCopyOf = (t: Words): TeamChatMessagesCopy => ({
    pin: t("pin"),
    unpin: t("unpin"),
    pinned: t("pinned"),
    report: t("reportBadge"),
    approvalPending: t("approvalPending"),
    approvalApproved: t("approvalApproved"),
    approvalRefused: t("approvalRefused"),
    approvalExpired: t("approvalExpired"),
    approve: t("approve"),
    refuse: t("refuse"),
    olderLabel: t("older"),
    openRun: t("openRun"),
    decidedBy: t("decidedBy"),
})

/** A refusal code in the viewer's words; a code the app does not know reads as a plain failure. */
const refusalWordsOf = (t: Words, code: string): string =>
    isChatRefusal(code) ? t(`refusal_${code}`) : t("sendFailedText")

/** The line that says who is typing in the room, or null when nobody is. */
const typingLineOf = (t: Words, names: ReadonlyArray<string>): string | null =>
    names.length === 0 ? null : `${names.join(", ")} ${t("typingSuffix")}`

/** The composer: its words, the draft and the file, the mentions the open `@` offers, and why the last send failed. */
const composerOf = (context: RoomViewContext): TeamChatRoomViewProps["composer"] => {
    const { room, t } = context
    const { composer } = room
    const trigger = mentionTriggerOf(composer.draft)
    return {
        formLabel: t("composerLabel"),
        messageLabel: t("messageLabel"),
        placeholder: context.withAgent ? t("agentPlaceholder") : t("placeholder"),
        sendLabel: t("send"),
        draft: composer.draft,
        typing: typingLineOf(t, room.thread.typing),
        file: {
            label: t("attach"),
            removeLabel: t("removeFile"),
            accept: CHAT_FILE_ACCEPT,
            name: composer.file.file === null ? null : composer.file.file.name,
            canPick: room.rooms.roomId !== null,
        },
        isSending: composer.isSending,
        isLoading: room.rooms.isLoading,
        canSend: !composer.isSending && (room.rooms.roomId !== null || context.withAgent),
        error:
            composer.error === null ? null : { title: t("sendFailedTitle"), text: refusalWordsOf(t, composer.error) },
        suggestions: trigger === null ? [] : suggestionsOf(room.parties, trigger.query),
    }
}

/** The thread of no room: empty once the rooms are read (an agent's room opens on the first message), else the rooms' own state. */
const noRoomSlotOf = (rooms: RoomViewContext["room"]["rooms"]["slot"]): DataSlot<ReadonlyArray<TeamChatMessageRow>> =>
    "items" in rooms ? { isEmpty: true } : rooms

/** What the room draws, from its state. */
export const roomViewPropsOf = (context: RoomViewContext): TeamChatRoomViewProps => {
    const { room, t } = context
    const { rooms, thread, cards } = room
    return {
        copy: copyOf(t, context.backLabel, context.withAgent),
        labels: context.labels,
        threadSlot: rooms.roomId === null ? noRoomSlotOf(rooms.slot) : thread.slot,
        isWaiting: isWaitingOf(rooms.slot, ...(rooms.roomId === null ? [] : [thread.slot])),
        roomId: rooms.roomId,
        title: rooms.room?.name ?? "",
        other: rooms.other,
        memberCount: rooms.room?.members.length ?? 0,
        tab: room.tab,
        canWrite: rooms.roomId !== null || context.withAgent,
        canGoBack: context.canGoBack,
        isMuted: rooms.roomId === null ? null : rooms.isMuted,
        messagesCopy: messagesCopyOf(t),
        hasOlder: thread.hasOlder,
        isLoadingOlder: thread.isLoadingOlder,
        decidingId: cards.decidingId,
        decideError: cards.decideRefusal === null ? null : refusalWordsOf(t, cards.decideRefusal),
        composer: composerOf(context),
    }
}
