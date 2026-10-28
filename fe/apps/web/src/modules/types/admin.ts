import type { BadgeTone } from "@starci/grammar/common"

/** One badge of a row or a cell. */
export interface AdminBadgeView {
    readonly id: string
    readonly label: string
    readonly tone: BadgeTone
    readonly isDot?: boolean
}

/** One row of an admin list card, already worded and formatted. */
export interface AdminRowView {
    readonly id: string
    readonly title: string
    /** The title is secondary copy (a summary row) rather than the row's name. */
    readonly isMuted?: boolean
    /** Qualifiers under the title. */
    readonly lines: ReadonlyArray<string>
    /** Raw error or job text, drawn small and monospaced. */
    readonly mono?: string
    /** A small muted note at the end of the row. */
    readonly note?: string
    readonly link?: { readonly label: string; readonly href: string }
    readonly badges: ReadonlyArray<AdminBadgeView>
}

/** One list card of the workspace or health page. */
export interface AdminCardView {
    readonly id: string
    readonly label: string
    readonly ariaLabel?: string
    readonly emptyMessage: string
    /** Badges drawn beside the card label. */
    readonly labelBadges: ReadonlyArray<AdminBadgeView>
    readonly rows: ReadonlyArray<AdminRowView>
}

/** One pending invitation a support action can resend. */
export interface AdminInviteRef {
    readonly id: string
    readonly email: string
}

/** One workspace of the list, already worded and formatted for its table row. */
export interface AdminWorkspaceRowView {
    readonly id: string
    readonly name: string
    readonly href: string
    readonly needsAttention: boolean
    readonly ownerEmail: string
    readonly status: string
    readonly statusTone: AdminBadgeView["tone"]
    readonly paidUntil: string | null
    readonly plan: string
    readonly created: string
    readonly members: number
    readonly modules: ReadonlyArray<AdminBadgeView>
    readonly connections: ReadonlyArray<AdminBadgeView>
    readonly connectionWarnings: ReadonlyArray<AdminBadgeView>
    readonly lastMessage: string
    readonly messages7d: number
    readonly openDecisions: number
}
