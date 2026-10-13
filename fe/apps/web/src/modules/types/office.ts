/** Resolves one Office message by key, with optional `{values}` (the next-intl translator of the `office` namespace). */
export type OfficeText = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** Who is drawn beside a bubble. */
export type OfficeAvatarView =
    | { readonly kind: "agent"; readonly glyph: string; readonly module: string; readonly label: string }
    | { readonly kind: "person"; readonly name: string }

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
    readonly isSimulated: boolean
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

/** One entry of the rendered thread. */
export type OfficeThreadItem =
    OfficeDayView | OfficeMessageView | OfficeApprovalView | OfficeExceptionView | OfficeCommandView

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

/** One row of the conversation list. */
export interface OfficeChatRowView {
    readonly id: string
    readonly label: string
    readonly description: string
    readonly time: string | null
    readonly avatar: OfficeAvatarView
}

/** The left column. */
export interface OfficeListView {
    readonly groupLabel: string
    readonly groupPreview: string
    readonly groupTime: string | null
    readonly pendingCount: number
    readonly agents: ReadonlyArray<OfficeChatRowView>
    readonly customers: ReadonlyArray<OfficeChatRowView>
}

/** A jump row of the info panel (an approval or an exception). */
export interface OfficeJumpRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
    readonly avatar: OfficeAvatarView
}

/** A member row of the info panel. */
export interface OfficeMemberRowView {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly seen: string | null
    readonly avatar: OfficeAvatarView
    readonly isMe: boolean
    readonly mention: string | null
    readonly chatHref: string | null
    readonly note: string | null
}

/** The right column. */
export interface OfficeInfoView {
    readonly approvals: ReadonlyArray<OfficeJumpRowView>
    readonly exceptions: ReadonlyArray<OfficeJumpRowView>
    readonly members: ReadonlyArray<OfficeMemberRowView>
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
