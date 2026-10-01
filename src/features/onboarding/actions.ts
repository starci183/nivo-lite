"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getT, getLocale } from "@/i18n/server";
import { onboarding } from "@/i18n/dict/onboarding";
import { createPaymentOrder, getPlan, readOrder, setWorkspaceCookie, type OrderStatus } from "@/lib/billing";
import { BUSINESS_TYPES } from "./constants";
import { seedWorkspace } from "@/lib/seed";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { Outcome } from "@/lib/types";

const signedIn = async () => {
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user;
};

/** Step 2 -> 3: create the workspace (pending_payment, creator = owner via A1's trigger) and its first payment order. */
export const createWorkspaceAction = async (input: { planCode: string; name: string; businessType: string }): Promise<Outcome<{ workspaceId: string; orderId: string }>> => {
  const t = await getT(onboarding);
  const user = await signedIn();
  if (!user) return { ok: false, error: t("errSignIn") };
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return { ok: false, error: t("errName") };
  const plan = await getPlan(input.planCode);
  if (!plan) return { ok: false, error: t("errPlan") };
  const businessType = (BUSINESS_TYPES as ReadonlyArray<string>).includes(input.businessType) ? input.businessType : "other";
  const admin = supabaseAdmin();
  const created = await admin
    .from("workspaces")
    .insert({ owner_id: user.id, name, status: "pending_payment", business_type: businessType })
    .select("id")
    .single<{ id: string }>();
  if (created.error) return { ok: false, error: created.error.message };
  const meta = user.user_metadata as { full_name?: string; name?: string };
  await seedWorkspace(admin, created.data.id, meta.full_name || meta.name || user.email?.split("@")[0] || "Owner", await getLocale());
  const order = await createPaymentOrder(created.data.id, user.id, plan);
  await setWorkspaceCookie(created.data.id);
  return { ok: true, data: { workspaceId: created.data.id, orderId: order.id } };
};

/** The member (any role) must belong to the workspace; returns it with its billing state, read under RLS. */
const myWorkspace = async (workspaceId: string) => {
  const db = await supabaseServer();
  const { data } = await db.from("workspaces").select("id, status, plan_code, paid_until").eq("id", workspaceId).maybeSingle();
  return data as { id: string; status: string; plan_code: string | null; paid_until: string | null } | null;
};

/** Polled by the payment screen. Reads under RLS, so only members of the workspace see the order. */
export const orderStatusAction = async (orderId: string): Promise<{ status: OrderStatus | "gone" }> => {
  const order = await readOrder(orderId);
  return { status: order?.status ?? "gone" };
};

/** "Tạo lại mã thanh toán": a fresh order for the same plan (the old one stays valid for a late transfer until it expires). */
export const newOrderAction = async (workspaceId: string): Promise<Outcome<{ orderId: string }>> => {
  const t = await getT(onboarding);
  const user = await signedIn();
  if (!user) return { ok: false, error: t("errSignIn") };
  const ws = await myWorkspace(workspaceId);
  if (!ws) return { ok: false, error: t("errWorkspace") };
  const db = await supabaseServer();
  const { data: last } = await db.from("payment_orders").select("plan_code").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1);
  const plan = await getPlan(ws.plan_code ?? (last?.[0] as { plan_code: string } | undefined)?.plan_code ?? "");
  if (!plan) return { ok: false, error: t("errPlan") };
  const order = await createPaymentOrder(workspaceId, user.id, plan);
  revalidatePath("/onboarding/payment");
  return { ok: true, data: { orderId: order.id } };
};

/** Make a workspace the current one (cookie), only when the person is an active member of it. */
export const switchWorkspaceAction = async (workspaceId: string): Promise<void> => {
  const user = await signedIn();
  if (!user) return;
  const { data } = await (await supabaseServer())
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return;
  await setWorkspaceCookie(workspaceId);
  revalidatePath("/", "layout");
};

/** Open a workspace from /workspaces: paid ones go to the console, unpaid ones the owner can pay for go to payment. */
export const openWorkspaceAction = async (workspaceId: string): Promise<void> => {
  const user = await signedIn();
  if (!user) redirect("/login");
  const db = await supabaseServer();
  const { data: m } = await db.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).eq("status", "active").maybeSingle<{ role: string }>();
  if (!m) return;
  const { data: ws } = await db.from("workspaces").select("status").eq("id", workspaceId).maybeSingle<{ status: string }>();
  await setWorkspaceCookie(workspaceId);
  if (ws?.status === "pending_payment" || ws?.status === "cancelled") {
    if (m.role === "owner") redirect(`/workspaces/new/payment?ws=${workspaceId}`);
    return;
  }
  revalidatePath("/", "layout");
  redirect("/chat");
};
