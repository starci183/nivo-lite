import type { LoyaltyMemberType } from "@/hooks/swr"
import type { BadgeTone } from "@starci/grammar/common"

/** The orders the member list can take. */
export type MemberSortKey = "points" | "lastVisit" | "spend"

/** The sort keys in the order the select lists them. */
export const MEMBER_SORTS: ReadonlyArray<MemberSortKey> = ["points", "lastVisit", "spend"]

/** How many members one page of the list shows. */
export const MEMBER_PAGE_SIZE = 50

/** Lower case without accents, so a search without accents finds the accented name. */
export const fold = (value: string): string =>
    value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase()

/** Phone digits grouped for reading, or the plain digits when too short to group. */
export const groupPhone = (phone: string | null | undefined): string => {
    const digits = (phone ?? "").replace(/\D/g, "")
    if (digits.length < 9) return digits
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}

/** The number a member is ordered by for this key. */
export const sortValue = (member: LoyaltyMemberType, key: MemberSortKey): number => {
    if (key === "points") return member.points
    if (key === "spend") return member.lifetimeSpendVnd
    return member.lastVisitAt === null || member.lastVisitAt === undefined ? 0 : Date.parse(member.lastVisitAt)
}

/** True when the member matches the typed text by name, or by at least three phone digits. */
export const matchesQuery = (member: LoyaltyMemberType, query: string): boolean => {
    const text = fold(query.trim())
    if (text === "") return true
    if (fold(member.name).includes(text)) return true
    const digits = query.replace(/\D/g, "")
    return digits.length >= 3 && (member.phone ?? "").replace(/\D/g, "").includes(digits)
}

/** The message key and count that say when the member last bought. */
export interface LastVisit {
    readonly key: "neverVisited" | "today" | "daysAgo"
    readonly n: number
}

/** "Never bought", "today" or "N days ago" for a last purchase time measured against the board clock. */
export const lastVisitOf = (
    iso: string | null | undefined,
    nowIso: string,
    daysSince: (iso: string, nowIso: string) => number,
): LastVisit => {
    if (iso === null || iso === undefined) return { key: "neverVisited", n: 0 }
    const days = daysSince(iso, nowIso)
    return days === 0 ? { key: "today", n: 0 } : { key: "daysAgo", n: days }
}

/** The reasons a reward cannot be redeemed, as the back end names them. */
const BLOCK_CODES: ReadonlyArray<string> = [
    "inactive",
    "out_of_stock",
    "not_enough_points",
    "limit_reached",
    "tier_required",
]

/** The message key for a redeem block code; an unknown code falls back to the generic message. */
export const blockMessageKey = (code: string): string =>
    BLOCK_CODES.includes(code) ? `block_${code}` : "blockFallback"

/** The ledger kinds the page has a label for. */
const LEDGER_KINDS: ReadonlyArray<string> = ["earn", "redeem", "expire", "adjust"]

/** True when the ledger kind has a `kind_*` label. */
export const isLedgerKind = (kind: string): boolean => LEDGER_KINDS.includes(kind)

/** The badge tone of a ledger kind (the label is always written too). */
export const ledgerTone = (kind: string): BadgeTone => {
    if (kind === "earn") return "success"
    if (kind === "redeem") return "accent"
    if (kind === "expire") return "warning"
    return "neutral"
}
