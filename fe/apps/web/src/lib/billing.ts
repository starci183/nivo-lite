import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  readBillingWorkspaces,
  readOpenPlanOrder,
  readPaymentOrder,
  readPlan,
  readPlans,
  writePaymentOrderRequest,
} from "@/modules/db";
import type { BillingWorkspace, OrderKind, OrderStatus, PaymentOrder, Plan, WorkspaceStatus } from "@/modules/db";
import { getAuthUser } from "./supabase/auth-user";

/**
 * Wave 3 shim: the billing helpers other lanes still import, now over `modules/db` (RLS reads; payment orders are asked for
 * through the `payment_order_request` rpc and made by the back end). New code imports `@/modules/db` directly.
 */
export type { BillingWorkspace, OrderKind, OrderStatus, PaymentOrder, Plan, WorkspaceStatus };

/** Cookie holding the workspace used last; same name as session.ts (kept literal to avoid importing the session here). */
const WORKSPACE_COOKIE = "NIVO_WORKSPACE";

export const listPlans = async (): Promise<Array<Plan>> => {
  const plans = await readPlans();
  return plans.kind === "ok" ? [...plans.value] : [];
};

export const getPlan = async (code: string): Promise<Plan | null> => {
  const plan = await readPlan(code);
  return plan.kind === "ok" ? plan.value : null;
};

/** The signed-in user's workspaces with their billing state (RLS: only the ones they belong to). */
export const myWorkspaces = async (): Promise<Array<BillingWorkspace>> => {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const workspaces = await readBillingWorkspaces(user.id);
  return workspaces.kind === "ok" ? [...workspaces.value] : [];
};

/**
 * Where a non-active workspace must go: pending_payment and cancelled workspaces see only the payment page.
 * `past_due` keeps working (grace) and is surfaced on /billing. Active -> null.
 */
export const paymentRedirectFor = (status: WorkspaceStatus | undefined | null): string | null =>
  status === "pending_payment" || status === "cancelled" ? "/workspaces/new/payment" : null;

/** Redirects to /workspaces/new/payment when the workspace is not paid yet. One cheap read; safe to call on every request. */
export const requireActiveWorkspace = async (workspaceId: string): Promise<void> => {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const workspaces = await readBillingWorkspaces(user.id);
  const status = workspaces.kind === "ok" ? workspaces.value.find((w) => w.id === workspaceId)?.status : undefined;
  const to = paymentRedirectFor(status);
  if (to) redirect(`${to}?ws=${workspaceId}`);
};

export const setWorkspaceCookie = async (workspaceId: string) => {
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
};

/** Asks for a pending payment order for the plan (the back end makes it; owner | manager only) and waits for it. */
export const createPaymentOrder = async (workspaceId: string, _userId: string, plan: Plan): Promise<PaymentOrder> => {
  const order = await writePaymentOrderRequest({ workspaceId, kind: "plan", target: plan.code });
  if (order.kind !== "ok") throw new Error(`payment order: ${order.kind} ${order.code}`);
  return order.value;
};

/** The order as the signed-in member sees it (RLS), with a pending -> expired reading once its time is up. */
export const readOrder = async (orderId: string): Promise<PaymentOrder | null> => {
  const order = await readPaymentOrder(orderId, new Date());
  return order.kind === "ok" ? order.value : null;
};

/** The newest plan payment of a workspace that can still be paid (pending and not expired), if any. */
export const latestOpenOrder = async (workspaceId: string): Promise<PaymentOrder | null> => {
  const order = await readOpenPlanOrder(workspaceId, new Date());
  return order.kind === "ok" ? order.value : null;
};

