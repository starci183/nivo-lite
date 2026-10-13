import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import type { ExpiringSoon, ExpiryEntry, IsoOrNull } from "../loyalty-ledger.contracts"

const DAY_MS = 86_400_000

const dueBy = (entry: ExpiryEntry, atMs: number): boolean =>
    entry.kind === "earn" && entry.expiresAt !== null && Date.parse(entry.expiresAt) <= atMs

/**
 * The points whose date has passed and that are still unspent. A redeem consumes the OLDEST earned points first, so the expired
 * amount is the earned-and-due total minus everything already spent or expired, and never more than the balance.
 */
export const expirablePoints = (entries: ReadonlyArray<ExpiryEntry>, atMs: number): number => {
    const due = entries.filter((entry) => dueBy(entry, atMs)).reduce((sum, entry) => sum + entry.points, 0)
    const spent = entries
        .filter((entry) => entry.kind === "redeem" || entry.kind === "expire")
        .reduce((sum, entry) => sum - entry.points, 0)
    const balance = entries.reduce((sum, entry) => sum + entry.points, 0)
    return Math.max(0, Math.min(due - spent, balance))
}

/** The earned points that expire inside the next `days` days and are still unspent, with the date of the first batch. */
export const expiringSoon = (entries: ReadonlyArray<ExpiryEntry>, nowMs: number, days: number): ExpiringSoon => {
    const horizon = nowMs + days * DAY_MS
    const coming = entries
        .flatMap((entry) => (entry.kind === "earn" && entry.expiresAt !== null ? [entry.expiresAt] : []))
        .filter((at) => Date.parse(at) > nowMs && Date.parse(at) <= horizon)
        .sort()
    return {
        points: Math.max(0, expirablePoints(entries, horizon) - expirablePoints(entries, nowMs)),
        firstAt: coming[0] ?? null,
    }
}

/** When points earned at `fromMs` expire under the programme, or null when they never do. */
export const expiryDate = (config: LoyaltyConfig, fromMs: number): IsoOrNull => {
    if (config.expiry.months <= 0) return null
    const date = new Date(fromMs)
    date.setUTCMonth(date.getUTCMonth() + config.expiry.months)
    return date.toISOString()
}
