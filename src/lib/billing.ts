import "server-only";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "./supabase/admin";
import { getAuthUser } from "./supabase/auth-user";
import { supabaseServer } from "./supabase/server";
import { newOrderCode } from "./sepay";

export type WorkspaceStatus = "pending_payment" | "active" | "past_due" | "cancelled";
export type OrderStatus = "pending" | "paid" | "expired" | "cancelled";

export type Plan = {
  code: string;
  name_vi: string;
  name_en: string;
  price_vnd: number;
  period: "month" | "year";
  seats: number;
  features: { vi: string[]; en: string[] };
  sort: number;
};

export type PaymentOrder = {
  id: string;
  workspace_id: string;
  plan_code: string;
  amount_vnd: number;
  order_code: string;
  status: OrderStatus;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
};

export type BillingWorkspace = { id: string; name: string; status: WorkspaceStatus; plan_code: string | null; paid_until: string | null };

/** Cookie holding the workspace used last; same name as session.ts (kept literal to avoid importing the session here). */
const WORKSPACE_COOKIE = "NIVO_WORKSPACE";

/** The plan catalogue is the same for everyone and changes by migration only: cached for 5 minutes (tag "plans"). Used for display; prices that charge money are read live by `getPlan`. */
const cachedPlans = unstable_cache(
  async (): Promise<Array<Plan>> => {
    const { data } = await supabaseAdmin().from("plans").select("*").eq("active", true).order("sort");
    return (data ?? []) as Array<Plan>;
  },
  ["plans_active"],
  { revalidate: 300, tags: ["plans"] },
);

export const listPlans = async (): Promise<Array<Plan>> => cachedPlans();

export const getPlan = async (code: string): Promise<Plan | null> => {
  const db = await supabaseServer();
  const { data } = await db.from("plans").select("*").eq("code", code).eq("active", true).maybeSingle();
  return (data as Plan | null) ?? null;
};

/** The signed-in user's workspaces with their billing state (RLS: only the ones they belong to). */
export const myWorkspaces = async (): Promise<Array<BillingWorkspace & { role: string }>> => {
  const db = await supabaseServer();
  const user = await getAuthUser();
  if (!user) redirect("/login");
  // One request: memberships with their workspace embedded (RLS: only the person's own).
  const { data } = await db.from("workspace_members").select("role, workspace:workspaces(id, name, status, plan_code, paid_until, created_at)").eq("user_id", user.id).eq("status", "active");
  type W = BillingWorkspace & { created_at: string };
  type Row = { role: string; workspace: W | Array<W> | null };
  return ((data ?? []) as unknown as Array<Row>)
    .flatMap((m) => { const w = Array.isArray(m.workspace) ? m.workspace[0] : m.workspace; return w ? [{ ...w, role: m.role }] : []; })
    .sort((x, y) => y.created_at.localeCompare(x.created_at));
};

/**
 * Where a non-active workspace must go: pending_payment and cancelled workspaces see only the payment page.
 * `past_due` keeps working (grace) and is surfaced on /billing. Active -> null.
 */
export const paymentRedirectFor = (status: WorkspaceStatus | undefined | null): string | null =>
  status === "pending_payment" || status === "cancelled" ? "/workspaces/new/payment" : null;

/**
 * Call from getSession (or any console route) with the current workspace id: redirects to /workspaces/new/payment when the
 * workspace is not paid yet. One cheap query; safe to call on every request.
 */
export const requireActiveWorkspace = async (workspaceId: string): Promise<void> => {
  const db = await supabaseServer();
  const { data } = await db.from("workspaces").select("status").eq("id", workspaceId).maybeSingle<{ status: WorkspaceStatus }>();
  const to = paymentRedirectFor(data?.status);
  if (to) redirect(`${to}?ws=${workspaceId}`);
};

export const setWorkspaceCookie = async (workspaceId: string) => {
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
};

/** Create a pending payment order (service role: customers never write billing tables). Retries on a code collision. */
export const createPaymentOrder = async (workspaceId: string, userId: string, plan: Plan): Promise<PaymentOrder> => {
  const admin = supabaseAdmin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from("payment_orders")
      .insert({ workspace_id: workspaceId, created_by: userId, plan_code: plan.code, amount_vnd: plan.price_vnd, order_code: newOrderCode() })
      .select()
      .single();
    if (!error) return data as PaymentOrder;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not allocate an order code");
};

/** The order as the signed-in member sees it (RLS), with a lazy pending -> expired flip once its time is up. */
export const readOrder = async (orderId: string): Promise<PaymentOrder | null> => {
  const db = await supabaseServer();
  const { data } = await db.from("payment_orders").select("*").eq("id", orderId).maybeSingle();
  const order = data as PaymentOrder | null;
  if (order && order.status === "pending" && new Date(order.expires_at).getTime() < Date.now()) {
    await supabaseAdmin().from("payment_orders").update({ status: "expired" }).eq("id", order.id).eq("status", "pending");
    return { ...order, status: "expired" };
  }
  return order;
};

/** The newest order of a workspace that can still be paid (pending and not expired), if any. */
export const latestOpenOrder = async (workspaceId: string): Promise<PaymentOrder | null> => {
  const db = await supabaseServer();
  const { data } = await db
    .from("payment_orders")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data ?? [])[0] as PaymentOrder | undefined) ?? null;
};
