import type { useTranslations } from "next-intl"
import { isWaitingOf } from "@/hooks/slot"
import { CHAT_FILE_ACCEPT, isChatRefusal, mentionTriggerOf, partyKeyOf, suggestionsOf } from "@/hooks/teamChat"
import type { TeamChatState } from "@/hooks/teamChat"
import type { TeamChatMessagesCopy } from "@/components/composites/TeamChatMessages"
import type { ChatParty, DataSlot, SlotLabels, TeamChatMessageRow } from "@/modules/types"
import type { TeamChatCopy, TeamChatViewProps } from "./types"

/** The translator of the team chat words. */
type Words = ReturnType<typeof useTranslations<"teamChat">>

/** What the view is made for: the page of every room, or the panel of one agent. */
export interface ViewContext {
    readonly chat: TeamChatState
    readonly t: Words
    /** The shared words of every pane frame (the refresh and the way back to the list). */
    readonly pane: { readonly refresh: string; readonly backToList: string }
    /** The page opened on an agent: the first message to it opens the room. */
    readonly withAgent: boolean
    /** The shared data-status words, with the empty sentence of the rooms. */
    readonly labels: SlotLabels
}

/** The words of the surface. */
export const copyOf = (t: Words, pane: ViewContext["pane"], withAgent: boolean): TeamChatCopy => ({
    grid: t("gridLabel"),
    title: t("title"),
    listLabel: t("listLabel"),
    threadLabel: t("threadLabel"),
    newChat: t("newChat"),
    refresh: pane.refresh,
    back: pane.backToList,
    tabAll: t("tabAll"),
    tabPinned: t("tabPinned"),
    tabsLabel: t("tabsLabel"),
    pickTitle: t("pickTitle"),
    pickBody: t("pickBody"),
    roomsEmpty: t("roomsEmpty"),
    roomsEmptyAction: t("roomsEmptyAction"),
    threadEmpty: withAgent ? t("agentThreadEmpty") : t("threadEmpty"),
    errorBody: t("errorBody"),
    members: t("members"),
    mute: t("mute"),
    unmute: t("unmute"),
    groupLine: t("groupLine"),
})

/** The words of the cards and controls of a thread. */
export const messagesCopyOf = (t: Words): TeamChatMessagesCopy => ({
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
export const refusalWordsOf = (t: Words, code: string): string =>
    isChatRefusal(code) ? t(`refusal_${code}`) : t("sendFailedText")

/** The line that says who is typing in the room, or null when nobody is. */
const typingLineOf = (t: Words, names: ReadonlyArray<string>): string | null =>
    names.length === 0 ? null : `${names.join(", ")} ${t("typingSuffix")}`

/** The composer: its words, the draft and the file, the mentions the open `@` offers, and why the last send failed. */
const composerOf = (context: ViewContext): TeamChatViewProps["composer"] => {
    const { chat, t } = context
    const { composer } = chat
    const trigger = mentionTriggerOf(composer.draft)
    return {
        formLabel: t("composerLabel"),
        messageLabel: t("messageLabel"),
        placeholder: context.withAgent ? t("agentPlaceholder") : t("placeholder"),
        sendLabel: t("send"),
        draft: composer.draft,
        typing: typingLineOf(t, chat.thread.typing),
        file: {
            label: t("attach"),
            removeLabel: t("removeFile"),
            accept: CHAT_FILE_ACCEPT,
            name: composer.file.file === null ? null : composer.file.file.name,
            canPick: chat.rooms.roomId !== null,
        },
        isSending: composer.isSending,
        isLoading: "isLoading" in chat.rooms.slot,
        canSend: !composer.isSending && (chat.rooms.roomId !== null || context.withAgent),
        error:
            composer.error === null ? null : { title: t("sendFailedTitle"), text: refusalWordsOf(t, composer.error) },
        suggestions: trigger === null ? [] : suggestionsOf(chat.parties, trigger.query),
    }
}

/** The new-chat drawer: its words and form, with the parties it picks from as options; none in the panel of an agent. */
const newChatOf = (context: ViewContext): TeamChatViewProps["newChat"] => {
    const { chat, t } = context
    const { form, people, agents } = chat.newChat
    const optionOf = (kind: "kindPerson" | "kindAgent") => (party: ChatParty) => ({
        id: partyKeyOf(party),
        label: party.name,
        description: t(kind),
    })
    return {
        isOpen: form.isOpen,
        copy: {
            title: t("newChatTitle"),
            description: t("newChatBody"),
            closeLabel: t("newChatClose"),
            directTitle: t("directTitle"),
            directLabel: t("directLabel"),
            directPlaceholder: t("directPlaceholder"),
            directStart: t("directStart"),
            groupTitle: t("groupTitle"),
            groupNameLabel: t("groupNameLabel"),
            groupMembersLabel: t("groupMembersLabel"),
            groupCreate: t("groupCreate"),
            empty: t("newChatEmpty"),
        },
        options: [...people.map(optionOf("kindPerson")), ...agents.map(optionOf("kindAgent"))],
        direct: form.direct,
        groupName: form.groupName,
        groupMembers: form.groupMembers,
        isPending: form.isPending,
        error: form.hasFailed ? t("newChatFailed") : null,
    }
}

/** Why the last answer to an approval card did not settle it, in the viewer's words; null when it did. */
const decideErrorOf = (context: ViewContext): string | null =>
    context.chat.cards.decideRefusal === null ? null : refusalWordsOf(context.t, context.chat.cards.decideRefusal)

/** The thread of no room: empty once the rooms are read (the panel of an agent writes the first message), else the rooms' own state. */
const noRoomSlotOf = (rooms: ViewContext["chat"]["rooms"]["slot"]): DataSlot<ReadonlyArray<TeamChatMessageRow>> =>
    "items" in rooms ? { isEmpty: true } : rooms

/** What the surface draws, from the state of the chat. */
export const viewPropsOf = (context: ViewContext, grid: TeamChatViewProps["grid"]): TeamChatViewProps => {
    const { chat, t } = context
    const { rooms, thread } = chat
    return {
        copy: copyOf(t, context.pane, context.withAgent),
        labels: context.labels,
        roomsSlot: rooms.slot,
        threadSlot: rooms.roomId === null ? noRoomSlotOf(rooms.slot) : thread.slot,
        isWaiting: isWaitingOf(rooms.slot, ...(rooms.roomId === null ? [] : [thread.slot])),
        selectedId: rooms.roomId,
        selectedTitle: rooms.room?.name ?? "",
        selectedOther: rooms.other,
        memberCount: rooms.room?.members.length ?? 0,
        tab: chat.tab,
        grid,
        messagesCopy: messagesCopyOf(t),
        hasOlder: thread.hasOlder,
        isLoadingOlder: thread.isLoadingOlder,
        decidingId: chat.cards.decidingId,
        decideError: decideErrorOf(context),
        composer: composerOf(context),
        isMuted: rooms.roomId === null ? null : rooms.isMuted,
        canWrite: rooms.roomId !== null || context.withAgent,
        newChat: newChatOf(context),
    }
}
