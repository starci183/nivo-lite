import "server-only";
import type { LoyaltyWorkbenchData } from "./module-loyalty-queries";

/**
 * Loyalty workbench figures for the agent dashboard ribbon. Every figure is derived from rows the workbench loader already read
 * (the member list with each member's last purchase, and the append-only points ledger of the last 30 days), so the ribbon and the
 * tabs below it never disagree and no second read is made.
 *
 *   activeMembers    members whose last purchase (an earn row) is within the last 60 days.
 *   pointsIssued30d  points of earn rows in the last 30 days (expired, redeemed and adjusted points are not counted).
 *   redemptions30d   redeem rows in the last 30 days, with the points they spent.
 *   atRisk           members with no purchase for 60 days; a member who never bought counts from the day they joined (the segment rule of module-loyalty-shared).
 */
export type LoyaltyFigures = {
  readonly members: number;
  readonly activeMembers: number;
  readonly pointsIssued30d: number;
  readonly redemptions30d: number;
  readonly pointsRedeemed30d: number;
  readonly atRisk: number;
};

const DAY = 86_400_000;
export const AT_RISK_DAYS = 60;

export const loyaltyFigures = (data: LoyaltyWorkbenchData): LoyaltyFigures => {
  const cutoff = Date.parse(data.nowIso) - AT_RISK_DAYS * DAY;
  let activeMembers = 0;
  let atRisk = 0;
  for (const m of data.members) {
    const lastActivity = Date.parse(m.lastVisitAt ?? m.joinedAt);
    if (m.lastVisitAt && lastActivity >= cutoff) activeMembers += 1;
    else if (lastActivity < cutoff) atRisk += 1;
  }
  const s = data.stats;
  return { members: data.members.length, activeMembers, pointsIssued30d: s.earned30d, redemptions30d: s.redemptions30d, pointsRedeemed30d: s.redeemed30d, atRisk };
};
