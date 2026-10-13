import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import type { Segment, SegmentPart } from "../loyalty-campaigns.contracts"

const DAY_MS = 86_400_000
const SHOP_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The month number (1 to 12) of an instant in Vietnam time. */
const monthOf = (ms: number): number =>
    Number(new Intl.DateTimeFormat("en-CA", { timeZone: SHOP_TIME_ZONE, month: "numeric" }).format(new Date(ms)))

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

/** The conditions of a segment as catalog parts, in the order a label reads them; none means every customer. */
export const segmentParts = (segment: Segment, tierNames: ReadonlyMap<string, string>): ReadonlyArray<SegmentPart> => [
    ...(segment.tiers.length > 0
        ? [
              {
                  key: "loyalty.segment.tiers",
                  params: { tiers: segment.tiers.map((key) => tierNames.get(key) ?? key).join(", ") },
              },
          ]
        : []),
    ...(segment.inactiveDays > 0 ? [{ key: "loyalty.segment.inactive", params: { days: segment.inactiveDays } }] : []),
    ...(segment.birthdayThisMonth ? [{ key: "loyalty.segment.birthday", params: {} }] : []),
    ...(segment.minSpendVnd > 0 ? [{ key: "loyalty.segment.minSpend", params: { amount: segment.minSpendVnd } }] : []),
]
