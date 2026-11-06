import { draftWithMention, mentionTriggerOf } from "@/hooks/teamChat"
import type { TeamChatState } from "@/hooks/teamChat"
import type { TeamChatHandlers } from "./types"

/** What the handlers need besides the chat: the phone panes and the way to the full page. */
interface HandlerContext {
    readonly showMain: () => void
    readonly showList: () => void
}

/** The mention the person picked, written into the draft in place of the open `@`. */
const mentionInto = (chat: TeamChatState) => (party: Parameters<TeamChatHandlers["mention"]>[0]) => {
    const trigger = mentionTriggerOf(chat.composer.draft)
    if (trigger !== null) chat.composer.setDraft(draftWithMention(chat.composer.draft, trigger, party))
}

/** What the new-chat drawer asks of its owner. */
const newChatHandlersOf = (chat: TeamChatState) => ({
    openNewChat: chat.newChat.open,
    newChatOpenChange: chat.newChat.setOpen,
    newChatDirect: chat.newChat.setDirect,
    newChatGroupName: chat.newChat.setGroupName,
    newChatGroupMembers: chat.newChat.setGroupMembers,
    newChatStartDirect: chat.newChat.startDirect,
    newChatCreateGroup: chat.newChat.createGroup,
})

/** What the surface asks of its owner, done on the state of the chat. */
export const handlersOf = (chat: TeamChatState, context: HandlerContext): TeamChatHandlers => ({
    refresh: chat.refresh,
    select: (roomId) => {
        chat.select(roomId)
        context.showMain()
    },
    back: context.showList,
    tab: chat.setTab,
    older: chat.thread.loadOlder,
    pin: (messageId, isPinned) => void chat.cards.togglePin(messageId, isPinned),
    decide: (decisionId, verdict) => void chat.cards.decide(decisionId, verdict),
    draft: chat.composer.setDraft,
    mention: mentionInto(chat),
    send: () => void chat.composer.send(),
    file: chat.composer.file.choose,
    fileClear: chat.composer.file.clear,
    toggleMute: () => void chat.rooms.toggleMute(),
    ...newChatHandlersOf(chat),
})
