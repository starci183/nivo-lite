import type { LoyaltyBoardType, LoyaltyConfigType, LoyaltyTierType } from "@/hooks/swr"
import type { BadgeTone } from "@starci/grammar/common"

/** The board shown while the first answer is on its way: no members, rewards or campaigns, read-only. */
export const EMPTY_LOYALTY_BOARD: LoyaltyBoardType = {
    campaigns: [],
    canManage: false,
    config: {
        birthday: { enabled: false, note: "", points: 0, rewardKey: "" },
        earn: { categories: [], minOrderVnd: 0, perThousandVnd: 0, perVisit: 0, trigger: "payment" },
        expiry: { months: 0, warnDays: 0 },
        promo: { batch: 0, hourFrom: "08:00", hourTo: "21:00", maxPerMonth: 0 },
        tiers: [],
    },
    figures: { activeMembers: 0, atRisk: 0, members: 0, pointsIssued30d: 0, pointsRedeemed30d: 0, redemptions30d: 0 },
    members: [],
    nowIso: "1970-01-01T00:00:00.000Z",
    program: null,
    rewards: [],
    stats: {
        active90d: 0,
        birthdaysThisMonth: 0,
        earned30d: 0,
        expired30d: 0,
        members: 0,
        pointsOutstanding: 0,
        promosSent30d: 0,
        redeemed30d: 0,
        redemptions30d: 0,
        rewardValue30d: 0,
        spend30d: 0,
        tierCounts: [],
    },
}

const DAY_MS = 86_400_000

/** The tier with this key, or null. */
export const findTier = (config: LoyaltyConfigType, key: string | null): LoyaltyTierType | null =>
    config.tiers.find((tier) => tier.key === key) ?? null

const tierRank = (config: LoyaltyConfigType, key: string | null): number =>
    config.tiers.findIndex((tier) => tier.key === key)

/** Badge tone climbs with the tier rank (the name is always written too, so colour is never the only signal). */
export const tierTone = (config: LoyaltyConfigType, key: string | null): BadgeTone => {
    const rank = tierRank(config, key)
    if (rank <= 0) return "neutral"
    return rank === config.tiers.length - 1 ? "success" : "accent"
}

/** Whole days between an ISO time and the board's `nowIso` (never negative). */
export const daysSince = (iso: string, nowIso: string): number =>
    Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(iso)) / DAY_MS))

/** Only the digits of a typed value, at most `max` of them. */
export const digitsOnly = (value: string, max = 10): string => value.replace(/[^\d]/g, "").slice(0, max)

/** Digits of a typed number ("45.000" becomes 45000); null when empty. */
export const parseDigits = (value: string): number | null => {
    const only = value.replace(/[^\d]/g, "")
    return only === "" ? null : Number(only)
}

/** A signed whole number typed as "+50", "-20" or "50"; null when it is not a number. */
export const parseSigned = (value: string): number | null => {
    const compact = value.trim().replace(/\s+/g, "")
    return /^[+-]?\d+$/.test(compact) ? Number(compact) : null
}

/** "1990-05-17" to "17/05/1990" (the shape typed into the birthday field). */
export const isoToInput = (iso: string | null): string =>
    iso !== null && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : ""

/** "17/05/1990" to "1990-05-17"; empty is null (no birthday), an impossible date is undefined. */
export const inputToIso = (value: string): string | null | undefined => {
    const text = value.trim()
    if (text === "") return null
    const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text)
    if (match === null) return undefined
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    const valid =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day &&
        year >= 1900 &&
        date.getTime() <= Date.now()
    return valid ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : undefined
}

/** The longest member name. */
export const LOYALTY_MEMBER_NAME_MAX = 80

/** The longest member note. */
export const LOYALTY_MEMBER_NOTE_MAX = 300

/** The longest reason of a point adjustment. */
export const LOYALTY_ADJUST_REASON_MAX = 300
