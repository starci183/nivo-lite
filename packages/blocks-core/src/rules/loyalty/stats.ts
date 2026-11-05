import type { LoyaltyTier } from "./config.types"
import type { LedgerKind, LedgerTotal, LoyaltyMember } from "./ledger.types"
import type { LoyaltyFigures, LoyaltyStats, MemberActivity } from "./stats.types"

const DAY_MS = 86_400_000
const ACTIVE_DAYS = 90
const QUIET_DAYS = 60

/** The time zone of the shops the programme serves. */
export const SHOP_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The month number (1 to 12) of an instant in Vietnam time. */
export const monthOf = (ms: number): number =>
    Number(new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIME_ZONE, month: "numeric" }).format(new Date(ms)))

const totalOf = (totals: ReadonlyArray<LedgerTotal>, kind: LedgerKind): LedgerTotal => ({
    kind,
    entries: totals.filter((total) => total.kind === kind).reduce((sum, total) => sum + total.entries, 0),
    points: totals.filter((total) => total.kind === kind).reduce((sum, total) => sum + total.points, 0),
    amountVnd: totals.filter((total) => total.kind === kind).reduce((sum, total) => sum + total.amountVnd, 0),
})

/** The statistics of the workbench from the members and what the ledger moved in the last 30 days. */
export const computeStats = (
    members: ReadonlyArray<LoyaltyMember>,
    totals: ReadonlyArray<LedgerTotal>,
    tiers: ReadonlyArray<LoyaltyTier>,
    promosSent30d: number,
    nowMs: number,
): LoyaltyStats => {
    const earn = totalOf(totals, "earn")
    const redeem = totalOf(totals, "redeem")
    const expire = totalOf(totals, "expire")
    const month = monthOf(nowMs)
    return {
        members: members.length,
        active90d: members.filter(
            (m) => m.lastVisitAt !== null && nowMs - Date.parse(m.lastVisitAt) <= ACTIVE_DAYS * DAY_MS,
        ).length,
        pointsOutstanding: members.reduce((sum, m) => sum + m.points, 0),
        earned30d: earn.points,
        redeemed30d: 0 - redeem.points,
        expired30d: 0 - expire.points,
        redemptions30d: redeem.entries,
        spend30d: earn.amountVnd,
        rewardValue30d: redeem.amountVnd,
        promosSent30d,
        birthdaysThisMonth: members.filter((m) => m.birthday !== null && Number(m.birthday.slice(5, 7)) === month)
            .length,
        tierCounts: tiers.map((tier) => ({
            key: tier.key,
            name: tier.name,
            count: members.filter((m) => m.tierKey === tier.key).length,
        })),
    }
}

const lastActivity = (member: LoyaltyMember): number => Date.parse(member.lastVisitAt ?? member.joinedAt)

/** How lively a member is: bought in the last 60 days, quiet for longer, or never bought and too new to tell. */
export const activityOf = (member: LoyaltyMember, nowMs: number): MemberActivity => {
    const quietSince = nowMs - QUIET_DAYS * DAY_MS
    if (lastActivity(member) < quietSince) return "at_risk"
    return member.lastVisitAt === null ? "new" : "active"
}

/** The ribbon of the workbench: the same rows as the tabs, so the two never disagree. */
export const computeFigures = (
    members: ReadonlyArray<LoyaltyMember>,
    stats: LoyaltyStats,
    nowMs: number,
): LoyaltyFigures => ({
    members: members.length,
    activeMembers: members.filter((m) => activityOf(m, nowMs) === "active").length,
    pointsIssued30d: stats.earned30d,
    redemptions30d: stats.redemptions30d,
    pointsRedeemed30d: stats.redeemed30d,
    atRisk: members.filter((m) => activityOf(m, nowMs) === "at_risk").length,
})
