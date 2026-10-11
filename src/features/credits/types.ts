/** What the "Credit & gói" page shows: plain data, every figure computed on the server. */

export type PlanView = {
  readonly code: string;
  readonly nameVi: string;
  readonly nameEn: string;
  /** Monthly credits (null = unlimited). */
  readonly credits: number | null;
  readonly price: number;
  /** VND per monthly credit. */
  readonly perCredit: number;
  readonly seats: number;
  readonly isCustom: boolean;
};

export type PackView = { readonly code: string; readonly credits: number; readonly price: number; readonly perCredit: number; readonly discountPct: number };

/** Why this plan is recommended, from real data. */
export type UpgradeReason =
  | { readonly kind: "topups"; readonly credits: number; readonly saving: number }
  | { readonly kind: "cheaper"; readonly pct: number }
  | { readonly kind: "plain" };

export type OrderRow = {
  readonly id: string;
  readonly kind: "plan" | "upgrade" | "topup";
  readonly planCode: string;
  readonly packCredits: number | null;
  readonly amount: number;
  readonly createdAt: string;
  readonly status: "pending" | "paid" | "expired" | "cancelled";
  readonly code: string;
};

export type CreditsData = {
  /** Owner | manager may buy; staff read only. */
  readonly canBuy: boolean;
  readonly paidUntil: string | null;
  readonly plan: PlanView | null;
  /** This month's credits spent, the allowance with rollover (null = unlimited) and the rollover itself. */
  readonly used: number;
  readonly limit: number | null;
  readonly carried: number;
  /** Top-up credits spendable now and the soonest date some of them expire. */
  readonly topup: number;
  readonly topupExpires: string | null;
  /** YYYY-MM-DD the allowance runs out this month at the last 7 days' burn, or null. */
  readonly runout: string | null;
  readonly packs: ReadonlyArray<PackView>;
  readonly plans: ReadonlyArray<PlanView>;
  readonly next: { readonly plan: PlanView; readonly reason: UpgradeReason } | null;
  /** Shown instead of an upgrade on Max and Enterprise. */
  readonly contact: { readonly plan: PlanView | null; readonly href: string } | null;
  readonly orders: ReadonlyArray<OrderRow>;
  readonly bank: { readonly account: string; readonly bank: string; readonly holder: string };
};

/** A payment screen's order: created on the server, shown as VietQR in the drawer. */
export type PayOrder = {
  readonly id: string;
  readonly code: string;
  readonly amount: number;
  readonly expiresAt: string;
  readonly qrUrl: string;
  /** Upgrade only: the unused value of the current plan that was deducted, and the days it is worth. */
  readonly credit?: number;
  readonly daysLeft?: number;
};
