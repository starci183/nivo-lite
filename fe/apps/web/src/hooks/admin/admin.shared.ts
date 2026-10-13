import type { BadgeTone } from "@starci/grammar/common"

/** Looks a message up by key in the admin catalog; the page supplies it from the server translator. */
export type AdminText = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** Dates, ages and money in the reader's locale; the page builds it from the server formatter. */
export interface AdminFormat {
    readonly date: (iso: string | null) => string
    readonly dateTime: (iso: string | null) => string
    readonly ago: (iso: string | null) => string
    readonly vnd: (amount: number | null) => string
    readonly usd: (amount: number) => string
    readonly count: (value: number) => string
}

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

/** One term and value of an overview list; a tone draws the value as a badge. */
export interface AdminFactView {
    readonly id: string
    readonly term: string
    readonly value: string
    readonly tone?: BadgeTone
}

/** One pending invitation a support action can resend. */
export interface AdminInviteRef {
    readonly id: string
    readonly email: string
}

/** The fewest days a subscription can be extended by. */
const EXTEND_DAYS_MIN = 1

/** The most days a subscription can be extended by. */
const EXTEND_DAYS_MAX = 366

/** The most monthly credits a workspace can be given. */
const CREDITS_MAX = 100_000_000

/** The plan codes a workspace can be moved to; the server re-checks that the plan exists and is on sale. */
export const PLAN_CODES = ["starter", "pro", "max", "enterprise"] as const

/** The whole days typed, or undefined when the text is not a day count in range. */
export const parseDays = (text: string): number | undefined => {
    const days = Number(text)
    return Number.isInteger(days) && days >= EXTEND_DAYS_MIN && days <= EXTEND_DAYS_MAX ? days : undefined
}

/** The credits typed: null for blank (the plan's applies), a whole number in range, or undefined when invalid. */
export const parseCredits = (text: string): number | null | undefined => {
    if (text.trim() === "") return null
    const credits = Number(text)
    return Number.isInteger(credits) && credits >= 0 && credits <= CREDITS_MAX ? credits : undefined
}

const BILLING_TONES: Readonly<Record<string, BadgeTone>> = {
    active: "success",
    pending_payment: "warning",
    past_due: "danger",
    cancelled: "neutral",
}

const MODULE_TONES: Readonly<Record<string, BadgeTone>> = {
    live: "success",
    ready: "accent",
    setup: "warning",
    installing: "neutral",
    paused: "neutral",
}

const HEALTH_TONES: Readonly<Record<string, BadgeTone>> = { ok: "success", error: "danger", silent: "warning" }

const FLOW_TONES: Readonly<Record<string, BadgeTone>> = {
    paid: "success",
    pending: "warning",
    expired: "neutral",
    cancelled: "neutral",
    received: "neutral",
    underpaid: "danger",
    unmatched: "danger",
    ignored: "neutral",
}

/** The tone of a workspace billing status. */
export const billingTone = (status: string): BadgeTone => BILLING_TONES[status] ?? "neutral"

/** The tone of an agent installation status. */
export const moduleTone = (status: string): BadgeTone => MODULE_TONES[status] ?? "neutral"

/** The tone of a connection health. */
export const healthTone = (health: string): BadgeTone => HEALTH_TONES[health] ?? "neutral"

/** The tone of a payment order or transfer status. */
export const flowTone = (status: string): BadgeTone => FLOW_TONES[status] ?? "neutral"

/** One badge of a row, cell or card label. */
export const badgeOf = (id: string, label: string, tone: BadgeTone, isDot = false): AdminBadgeView => ({
    id,
    label,
    tone,
    isDot,
})

/** What a support action came to, without the transport behind it. */
export type AdminReply =
    | { readonly kind: "ok"; readonly isUndelivered: boolean }
    | { readonly kind: "failed"; readonly message: string | undefined }
