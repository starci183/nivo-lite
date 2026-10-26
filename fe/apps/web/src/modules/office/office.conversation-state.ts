import type { OfficeConversationState, OfficeUnreadBadgeView } from "@/modules/types"
import { mentionsOf } from "./office.helpers"

/** The viewer's identity as the composer writes mentions: a staff handle or their workspace display name. */
export interface OfficeMentionViewer {
    readonly name: string | null
    readonly handle: string | null
}

/** Whether any unread incoming body addresses the viewer, with an exact handle or a complete @display name. */
export const hasUnreadMention = (bodies: ReadonlyArray<string>, viewer: OfficeMentionViewer | undefined): boolean =>
    viewer !== undefined &&
    bodies.some((body) => {
        const text = body.toLowerCase()
        if (viewer.handle !== null && mentionsOf(text).includes(viewer.handle.toLowerCase())) return true
        const name = viewer.name?.trim().toLowerCase()
        return (
            name !== undefined &&
            name !== "" &&
            text
                .split(`@${name}`)
                .slice(1)
                .some((after) => !/^[\p{L}\p{N}_-]/u.test(after))
        )
    })

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
