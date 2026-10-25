import type { OfficeConversationState, OfficeUnreadBadgeView } from "@/modules/types"

/** The most unread lines a row counts out; more reads as "5+". */
export const UNREAD_CAP = 5

/** The flags of a conversation whose source reports none. */
export const NO_CONVERSATION_STATE: OfficeConversationState = {
    hasMention: false,
    isMuted: false,
    isLastSeen: false,
    isTyping: false,
}

/** The unread indicator of a row: nothing when read, a dot when muted, otherwise the capped count (with the mention mark). */
export const unreadBadgeOf = (unread: number, state: OfficeConversationState): OfficeUnreadBadgeView | null => {
    if (unread <= 0) return null
    if (state.isMuted) return { kind: "dot" }
    return {
        kind: "count",
        label: unread > UNREAD_CAP ? `${UNREAD_CAP}+` : String(unread),
        hasMention: state.hasMention,
    }
}
