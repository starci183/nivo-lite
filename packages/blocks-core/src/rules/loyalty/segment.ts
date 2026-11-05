import type { LoyaltyMember } from "./ledger.types"
import type { Segment } from "./segment.types"
import { monthOf } from "./stats"

const DAY_MS = 86_400_000

/** Whether a customer belongs to a segment at an instant. */
export const inSegment = (member: LoyaltyMember, segment: Segment, nowMs: number): boolean => {
    if (segment.tiers.length > 0 && !segment.tiers.includes(member.tierKey ?? "")) return false
    if (segment.minSpendVnd > 0 && member.lifetimeSpendVnd < segment.minSpendVnd) return false
    if (
        segment.inactiveDays > 0 &&
        nowMs - Date.parse(member.lastVisitAt ?? member.joinedAt) < segment.inactiveDays * DAY_MS
    )
        return false
    if (segment.birthdayThisMonth) {
        return member.birthday !== null && Number(member.birthday.slice(5, 7)) === monthOf(nowMs)
    }
    return true
}
