"use server";

import { getT } from "@/i18n/server";
import { credits as dict } from "@/i18n/dict/credits";
import type { PaymentOrder } from "@/lib/billing";
import { CreditsError, createTopupOrder, createUpgradeOrder, type CreditsErrorCode } from "@/lib/credits";
import { isManagerRole } from "@/lib/members-shared";
import { qrImageUrl } from "@/lib/sepay";
import { getSession } from "@/lib/session";
import type { Outcome } from "@/lib/types";
import type { PayOrder } from "./types";

const toPay = (o: PaymentOrder, extra: Partial<PayOrder> = {}): PayOrder => ({
  id: o.id, code: o.order_code, amount: Number(o.amount_vnd), expiresAt: o.expires_at, qrUrl: qrImageUrl(Number(o.amount_vnd), o.order_code), ...extra,
});

const ERROR_KEY: Record<CreditsErrorCode, "errPack" | "errWorkspace" | "errPlan" | "errNotUpgrade" | "errRenewFirst" | "errZero"> = {
  pack: "errPack", workspace: "errWorkspace", plan: "errPlan", notUpgrade: "errNotUpgrade", renewFirst: "errRenewFirst", zero: "errZero",
};

/**
 * The workspace is the signed-in person's CURRENT one (session), never an id from the browser, and only owner | manager may buy.
 * Everything that charges money (price, credits, proration) is computed here from the database.
 */
const run = async (make: (workspaceId: string, userId: string) => Promise<PayOrder>): Promise<Outcome<PayOrder>> => {
  const t = await getT(dict);
  const session = await getSession();
  if (!isManagerRole(session.member.role)) return { ok: false, error: t("errForbidden") };
  try {
    return { ok: true, data: await make(session.workspace.id, session.userId) };
  } catch (e) {
    if (e instanceof CreditsError) return { ok: false, error: t(ERROR_KEY[e.code]) };
    console.error("credits order failed:", e instanceof Error ? e.message : String(e));
    return { ok: false, error: t("errGeneric") };
  }
};

/** "Mua": a pending top-up order for one pack (the same open order when it was just asked for). */
export const buyPackAction = async (packCode: string): Promise<Outcome<PayOrder>> =>
  run(async (workspaceId, userId) => toPay(await createTopupOrder(workspaceId, userId, packCode)));

/** "Nâng cấp": a pending upgrade order for the prorated difference. */
export const upgradeAction = async (planCode: string): Promise<Outcome<PayOrder>> =>
  run(async (workspaceId, userId) => {
    const { order, quote } = await createUpgradeOrder(workspaceId, userId, planCode);
    return toPay(order, { credit: quote.credit, daysLeft: quote.daysLeft });
  });
