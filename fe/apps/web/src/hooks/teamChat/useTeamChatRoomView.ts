"use client"

import { useTranslations } from "next-intl"
import { CHAT_FILE_ACCEPT, isChatRefusal, mentionTriggerOf, suggestionsOf } from "@/modules/teamChat"
import { messagesCopyOf } from "./teamChat.copy"
import { useChatRowWords } from "./useChatRowWords"
import { headOf, panelsOf } from "./teamChat.head"
import type { TeamChatRoomState } from "./useTeamChatRoomState"
import type { AgentOfRoom, RoomViewContext, Words } from "./teamChat.view"
import { usePaneCopy } from "@/hooks/paneFrame"
import { isWaitingOf, useSlotLabels } from "@/hooks/slot"
import { quoteOf } from "./teamChat.shared"
import type {
    DataSlot,
    TeamChatForwardView,
    TeamChatMessageRow,
    TeamChatRoomCopy,
    TeamChatRoomViewProps,
} from "@/modules/types"

/** The words of the room. */
const copyOf = (t: Words, backLabel: string, agent: AgentOfRoom | null): TeamChatRoomCopy => ({
    back: backLabel,
    threadLabel: t("threadLabel"),
    pickTitle: t("pickTitle"),
    pickBody: t("pickBody"),
    threadEmpty: agent === null ? t("threadEmpty") : t("agentThreadEmpty", { agent: agent.name }),
    errorBody: t("errorBody"),
    mute: t("mute"),
    unmute: t("unmute"),
    pinnedOpen: t("pinned"),
    pinnedEmpty: t("pinnedEmpty"),
    membersOpen: t("membersTitle"),
    panelClose: t("newChatClose"),
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
        placeholder: context.agent === null ? t("placeholder") : t("agentPlaceholder"),
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
        canSend: !composer.isSending && (room.rooms.roomId !== null || context.agent !== null),
        error:
            composer.error === null ? null : { title: t("sendFailedTitle"), text: refusalWordsOf(t, composer.error) },
        suggestions: trigger === null ? [] : suggestionsOf(room.parties, trigger.query),
        reply:
            room.replying === null
                ? null
                : {
                      title: t("replyingTo", { name: room.replying.authorName }),
                      body: quoteOf(room.replying.body),
                      clearLabel: t("replyClear"),
                  },
    }
}

/** The dialog that picks the room a message is forwarded to. */
const forwardOf = (context: RoomViewContext): TeamChatForwardView => {
    const { room, t } = context
    const { forward } = room
    return {
        isOpen: forward.messageId !== null,
        title: t("forwardTitle"),
        description: t("forwardBody"),
        closeLabel: t("newChatClose"),
        empty: t("forwardEmpty"),
        rooms: forward.rooms,
        sendingId: forward.sendingId,
        error: forward.error === null ? null : forward.error === "failed" ? t("forwardFailed") : refusalWordsOf(t, forward.error),
    }
}

/** The thread of no room: empty once the rooms are read (an agent's room opens on the first message), else the rooms' own state. */
const noRoomSlotOf = (rooms: RoomViewContext["room"]["rooms"]["slot"]): DataSlot<ReadonlyArray<TeamChatMessageRow>> =>
    "items" in rooms ? { isEmpty: true } : rooms

/** What the room draws, from its state. */
const roomViewPropsOf = (context: RoomViewContext): TeamChatRoomViewProps => {
    const { room, t } = context
    const { rooms, thread, cards } = room
    const threadSlot = rooms.roomId === null ? noRoomSlotOf(rooms.slot) : thread.slot
    const hasAgent =
        context.agent !== null || rooms.room?.members.some((member) => member.memberKind === "agent") === true
    return {
        copy: copyOf(t, context.backLabel, context.agent),
        labels: context.labels,
        threadSlot,
        threadAlign: "items" in threadSlot || "isLoading" in threadSlot ? "end" : "center",
        isWaiting: isWaitingOf(rooms.slot, ...(rooms.roomId === null ? [] : [thread.slot])),
        head: headOf(context),
        panels: panelsOf(context),
        canWrite: rooms.roomId !== null || context.agent !== null,
        canGoBack: context.canGoBack,
        isMuted: rooms.roomId === null ? null : rooms.isMuted,
        messagesCopy: messagesCopyOf(t),
        askSuggestions: hasAgent ? [t("agentSuggest1"), t("agentSuggest2"), t("agentSuggest3")] : [],
        hasOlder: thread.hasOlder,
        isLoadingOlder: thread.isLoadingOlder,
        decidingId: cards.decidingId,
        decideError: cards.decideRefusal === null ? null : refusalWordsOf(t, cards.decideRefusal),
        forward: forwardOf(context),
        composer: composerOf(context),
    }
}

/** Where the room stands on its page: opened by a direct room with an agent, and whether its head leads back to the list. */
interface RoomMode {
    readonly agent: AgentOfRoom | null
    readonly canGoBack: boolean
}

/** What the room draws, from its state, in the viewer's words. */
export const useTeamChatRoomView = (room: TeamChatRoomState, mode: RoomMode): TeamChatRoomViewProps => {
    const t = useTranslations("teamChat")
    const pane = usePaneCopy()
    const slotLabels = useSlotLabels()
    const words = useChatRowWords()
    return roomViewPropsOf({
        room,
        t,
        words,
        backLabel: pane.backToList,
        labels: { ...slotLabels(t("roomsEmpty")), error: t("errorTitle") },
        agent: mode.agent,
        canGoBack: mode.canGoBack,
    })
}
