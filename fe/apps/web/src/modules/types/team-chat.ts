/** What a person answers an approval card with. */
export type TeamChatVerdict = "approved" | "refused"

/** Who a room member, a message author or a mention is. */
export type ChatPartyKind = "user" | "agent"

/** A person or an agent the composer may mention, or the new-chat form may pick. */
export interface ChatParty {
    readonly kind: ChatPartyKind
    readonly id: string
    readonly name: string
}

/** One room of the list, with every word resolved. */
export interface TeamChatRoomRow {
    readonly id: string
    readonly kind: "direct" | "group"
    readonly title: string
    /** Who the room is with when it is direct (the mark it wears); null for a group. */
    readonly other: ChatParty | null
    /** The last message in one line (author and text), or the empty line. */
    readonly preview: string
    /** The time of the last message in the short form, or empty. */
    readonly when: string
    readonly unread: number
    readonly mentions: number
    readonly isSelected: boolean
}

/** The state of the decision a card carries. */
export type TeamChatApprovalStatus = "pending" | "approved" | "refused" | "expired"

/** The approval card of a message: one decision, the same one the workbench pane shows. */
export interface TeamChatApprovalView {
    readonly decisionId: string
    readonly status: TeamChatApprovalStatus
    /** Who settled it, empty while pending. */
    readonly decidedBy: string
    readonly decidedAt: string
    /** The viewer holds the right the decide door checks. */
    readonly canDecide: boolean
}

/** One file under a message. */
export interface TeamChatFileView {
    readonly id: string
    readonly name: string
    readonly contentType: string
    readonly url: string
}

/** One message of the open thread, with every word resolved. */
export interface TeamChatMessageRow {
    readonly id: string
    readonly kind: "text" | "report" | "approval" | "system"
    readonly side: "outgoing" | "incoming"
    readonly author: ChatParty | null
    readonly authorName: string
    readonly body: string
    readonly timeLabel: string
    /** The day it opens when it is the first of its day, else null: the thread draws a divider before it. */
    readonly dayLabel: string | null
    readonly pinned: boolean
    readonly files: ReadonlyArray<TeamChatFileView>
    /** Where the run a report belongs to opens, or null when the message is no report or its agent is gone. */
    readonly reportHref: string | null
    readonly approval: TeamChatApprovalView | null
}
