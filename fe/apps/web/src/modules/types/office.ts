import type { ModuleIconName } from "@/modules/types/module-icon"
/** Resolves one Office message by key, with optional `{values}` (the next-intl translator of the `office` namespace). */
export type OfficeText = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** Who is drawn beside a bubble. */
export type OfficeAvatarView =
    | {
          readonly kind: "agent"
          readonly glyph: ModuleIconName
          readonly module: string
          readonly label: string
          /** The agent id: the generated avatar of an agent without a picture. */
          readonly seed: string
          /** The picture the owner gave the agent, or null. */
          readonly src: string | null
      }
    | { readonly kind: "person"; readonly name: string; readonly src?: string | null }

/** One piece of a message body: plain text or an @mention. */
export interface OfficeBodyPart {
    readonly key: string
    readonly text: string
    readonly isMention: boolean
}

/** A day divider of the thread. */
export interface OfficeDayView {
    readonly kind: "day"
    readonly key: string
    readonly label: string
}

/** A chat line: a bubble, or a centred notice for system lines. */
export interface OfficeMessageView {
    readonly kind: "message"
    readonly key: string
    readonly variant: "bubble" | "notice"
    readonly side: "outgoing" | "incoming"
    /** The author line, only on the first bubble of someone else's group. */
    readonly author: string | null
    /** The avatar, only on the first bubble of someone else's group. */
    readonly avatar: OfficeAvatarView | null
    readonly isAi: boolean
    readonly isContinuation: boolean
    readonly time: string
    readonly showTime: boolean
    readonly parts: ReadonlyArray<OfficeBodyPart>
    readonly copyText: string
    readonly leadHref: string | null
    readonly leadLabel: string
    readonly workHref: string | null
    /** The agent handle the Reply action mentions, when an agent wrote the line. */
    readonly replyHandle: string | null
    /** The delivery state under my LAST line only; null on every other line. */
    readonly status: OfficeMessageStatusView | null
}

/** How far my last line got: persisted, fetched by another member's client, or read by another member. */
export type OfficeMessageStatusKind = "sent" | "delivered" | "seen"

/** One member who has read my last line. */
export interface OfficeSeenReaderView {
    readonly id: string
    readonly name: string
    readonly avatarUrl: string | null
}

/** The status under my last line: its words and, once seen, who read it. */
export interface OfficeMessageStatusView {
    readonly kind: OfficeMessageStatusKind
    readonly label: string
    /** Every reader, oldest read first; the view draws the first few and a "+N". */
    readonly readers: ReadonlyArray<OfficeSeenReaderView>
    /** Readers beyond the names in `readers`; the view says "N more". */
    readonly moreReaders: number
}

/** An approval request as a card under an agent line. */
export interface OfficeApprovalView {
    readonly kind: "approval"
    readonly key: string
    readonly id: string
    readonly anchor: string
    readonly author: string
    readonly avatar: OfficeAvatarView
    readonly time: string
    readonly title: string
    readonly target: string
    readonly status: "waiting" | "approved" | "rejected"
    readonly statusLabel: string
    readonly draft: string
    readonly settled: string
    readonly leadHref: string | null
    readonly canAct: boolean
    readonly isFocused: boolean
}

/** One missing input of an exception. */
export interface OfficeMissingField {
    readonly name: string
    readonly label: string
}

/** One choice of an exception. */
export interface OfficeChoice {
    readonly id: string
    readonly label: string
    readonly description: string | null
}

/** Who posted a Hub card and how it shows: the anchor a jump scrolls to, the author, the AI mark, the time, the title, the focus. */
export interface OfficeCardIdentity {
    readonly anchor: string
    readonly author: string
    readonly isAi: boolean
    readonly time: string
    readonly title: string
    readonly isFocused: boolean
}

/** A work item the flow could not finish alone, as a card under a department line. */
export interface OfficeExceptionView {
    readonly kind: "exception"
    readonly key: string
    readonly id: string
    readonly anchor: string
    readonly author: string
    readonly avatar: OfficeAvatarView
    readonly isAi: boolean
    readonly time: string
    readonly title: string
    readonly hint: string | null
    readonly status: "open" | "failed" | "done" | "rejected"
    readonly badge: string
    readonly department: string
    readonly reasonBadge: string | null
    readonly isReconcile: boolean
    readonly errorText: string | null
    readonly summary: string
    readonly draft: string | null
    readonly amount: number | null
    readonly missing: ReadonlyArray<OfficeMissingField>
    readonly choices: ReadonlyArray<OfficeChoice>
    readonly creditLine: string | null
    readonly result: string | null
    readonly decidedBasis: string | null
    readonly heldLine: string | null
    readonly footer: string | null
    readonly leadHref: string | null
    readonly canAct: boolean
    readonly isFocused: boolean
}

/** The confirm card of an owner's "@agent ..." message. */
export interface OfficeCommandView {
    readonly kind: "command"
    readonly key: string
    readonly id: string
    readonly anchor: string
    readonly status: "pending" | "sent" | "cancelled"
    readonly avatar: OfficeAvatarView
    readonly ask: string
    readonly agent: string
    readonly what: string
    readonly rows: ReadonlyArray<{ readonly key: string; readonly label: string; readonly value: string }>
    readonly note: string
    readonly detail: string | null
    readonly workHref: string | null
}

/** An agent result card (draft post, video, report, booking held...) with its live state and its actions. */
export interface OfficeResultCardView {
    readonly kind: "card"
    readonly key: string
    /** The message id. */
    readonly id: string
    readonly anchor: string
    readonly author: string
    readonly avatar: OfficeAvatarView
    readonly isAi: boolean
    readonly time: string
    /** The agent's own line above the card, when it differs from the title. */
    readonly lead: string | null
    readonly type: string
    readonly typeLabel: string
    readonly title: string
    readonly subtitle: string | null
    readonly badge: string | null
    readonly state: "pending" | "approved" | "declined" | "done" | "failed" | "queued" | "info"
    readonly body: string | null
    readonly fields: ReadonlyArray<{ readonly label: string; readonly value: string }>
    readonly media: ReadonlyArray<{
        readonly kind: "image" | "video"
        readonly url: string
        readonly caption: string | null
        /** The real captions track of a video (WebVTT link, menu label, language when known), or null when it has none. */
        readonly captions: { readonly src: string; readonly label: string; readonly srcLang?: string } | null
    }>
    readonly lines: ReadonlyArray<{ readonly at: string; readonly text: string }>
    readonly link: { readonly label: string; readonly href: string } | null
    /** The sources the agent used, each "layer · label". */
    readonly sources: ReadonlyArray<{ readonly label: string }>
    /** What the actions decide: an execution (approval) or a work item (exception). */
    readonly refKind: "execution" | "work_item" | null
    readonly refId: string | null
    readonly canApprove: boolean
    readonly canDecline: boolean
    readonly canEdit: boolean
    readonly isFocused: boolean
}

/** One entry of the rendered thread. */
export type OfficeThreadItem =
    | OfficeDayView
    | OfficeMessageView
    | OfficeApprovalView
    | OfficeExceptionView
    | OfficeCommandView
    | OfficeResultCardView

/** An optimistic bubble of a line being sent. */
export interface OfficeOutboxView {
    readonly id: string
    readonly parts: ReadonlyArray<OfficeBodyPart>
    readonly isFailed: boolean
}

/** What the owner decides on an exception. */
export interface OfficeWorkDecision {
    readonly decision: "approved" | "rejected"
    readonly draft: string | null
    readonly amountVnd: number | null
    readonly fields: ReadonlyArray<{ readonly key: string; readonly value: string }>
    readonly candidateId: string | null
    readonly basis: string | null
}

/** One member shown in the composite avatar of a Hub room. */
export interface OfficeRoomMemberPreviewView {
    /** The workspace account id or agent id. */
    readonly id: string
    readonly kind: "human" | "agent"
    /** The agent's module; null for a person. */
    readonly module: string | null
    readonly name: string
    /** The existing profile picture URL, or null for the name-based avatar. */
    readonly avatarUrl: string | null
}

/** The total membership and at most four avatar previews of a Hub room. */
export interface OfficeRoomMembersView {
    readonly count: number
    readonly preview: ReadonlyArray<OfficeRoomMemberPreviewView>
}

/** What a last line is, for the one-line preview of a row. */
export type OfficePreviewKind = "text" | "image" | "video" | "file" | "call" | "reminder"

/** The per-member flags of a conversation row. A source that does not report one leaves it false. */
export interface OfficeConversationState {
    /** Someone mentioned me in the unread lines. */
    readonly hasMention: boolean
    /** I muted the conversation: a dot replaces the count. */
    readonly isMuted: boolean
    /** My last line was read by another member. */
    readonly isLastSeen: boolean
    /** Someone is typing in the conversation now. */
    readonly isTyping: boolean
}

/** The unread indicator of a row: a count capped for display, or a dot when the conversation is muted. */
export type OfficeUnreadBadgeView =
    { readonly kind: "count"; readonly label: string; readonly hasMention: boolean } | { readonly kind: "dot" }

/** One Hub room of the room list. */
export interface OfficeRoomRowView {
    /** The room key, or "office" for the general Office room. */
    readonly id: string
    readonly label: string
    readonly description: string
    readonly time: string | null
    /** The last-activity instant the conversation list sorts by; null sinks the row. */
    readonly sortAt: string | null
    readonly unread: number
    readonly state: OfficeConversationState
    readonly members?: OfficeRoomMembersView | null
}

/** What every conversation row shows: the name, the one-line preview, its time and the unread state. */
interface OfficeConversationBaseView {
    readonly id: string
    readonly label: string
    /** The one-line preview, sender prefix and media label included. */
    readonly description: string
    readonly time: string | null
    readonly unread: number
    /** Unread lines: name and preview are drawn strong. */
    readonly isUnread: boolean
    readonly badge: OfficeUnreadBadgeView | null
    readonly isLastSeen: boolean
    readonly isTyping: boolean
    readonly members?: OfficeRoomMembersView | null
}

/** One row of the single conversation list: a Hub room, an agent or a recent customer. */
export type OfficeConversationRowView =
    | (OfficeConversationBaseView & {
          readonly kind: "group"
          /** The member composite of the room; null when the wire sends none. */
          readonly members: OfficeRoomMembersView | null
      })
    | (OfficeConversationBaseView & {
          readonly kind: "agent" | "customer"
          /** The person/agent mark of the direct row. */
          readonly avatar: OfficeAvatarView
      })

/** One channel of the room panel. */
export interface OfficeChannelRowView {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly isConnected: boolean
    readonly statusLabel: string
}

/** One pinned document of the room panel. */
export interface OfficePinRowView {
    readonly id: string
    readonly title: string
    readonly note: string
    readonly href: string | null
}

/** The left column. */
export interface OfficeListView {
    /** Every conversation of the panel, the newest activity first. */
    readonly conversations: ReadonlyArray<OfficeConversationRowView>
    /** The id of the room shown. */
    readonly selectedRoom: string
    readonly pendingCount: number
}

/** A jump row of the info panel (an approval or an exception). */
export interface OfficeJumpRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
    readonly avatar: OfficeAvatarView
}

/** A row of "Cần bạn duyệt": an approval card or a work item waiting for a decision, and the card in the thread it jumps to. */
export interface OfficeWaitingRowView extends OfficeJumpRowView {
    readonly target: "approval" | "exception"
}

/** A member row of the info panel. */
export interface OfficeMemberRowView {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly seen: string | null
    readonly avatar: OfficeAvatarView
    readonly isMe: boolean
    /** The "on duty" chip of an active agent (the name is already beside it); null for a person. */
    readonly presence: string | null
    readonly mention: string | null
    readonly chatHref: string | null
    readonly note: string | null
    /** A link under the note (a waiting agent: where to connect what it waits for); null when there is none. */
    readonly noteAction: { readonly label: string; readonly href: string } | null
}

/** The right column. */
export interface OfficeInfoView {
    /** Everything that waits for a person's decision, oldest first: the approval cards and the work items waiting for a decision. */
    readonly approvals: ReadonlyArray<OfficeWaitingRowView>
    /** The work items that failed and need a look, not a decision. */
    readonly exceptions: ReadonlyArray<OfficeJumpRowView>
    readonly members: ReadonlyArray<OfficeMemberRowView>
    /** Pending result cards of the room, jumping to their card. */
    readonly cards: ReadonlyArray<OfficeJumpRowView>
    readonly channels: ReadonlyArray<OfficeChannelRowView>
    readonly pins: ReadonlyArray<OfficePinRowView>
    readonly tasksSummary: string
    readonly addAgentHref: string
}

/** One team task row. */
export interface OfficeTaskView {
    readonly id: string
    readonly title: string
    readonly status: "open" | "waiting_approval" | "done"
    readonly nextAction: string
    readonly owner: string
    readonly meta: string
    readonly leadHref: string
}

/** One entry of the @mention list of the composer. */
export interface OfficeMentionView {
    readonly id: string
    readonly label: string
    readonly description: string
}
