"use server";

import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { billing } from "@/i18n/dict/billing";
import { createPaymentOrder, getPlan } from "@/lib/billing";
import { supabaseServer } from "@/lib/supabase/server";
import type { Outcome } from "@/lib/types";

/** "Gia hạn": a new payment order for the workspace's plan (owner | manager), then the same QR screen as onboarding. */
export const renewAction = async (workspaceId: string): Promise<Outcome<null>> => {
  const t = await getT(billing);
  const db = await supabaseServer();
  const { data: u } = await db.auth.getUser();
  if (!u.user) redirect("/login");
  const { data: m } = await db
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", u.user.id)
    .eq("status", "active")
    .maybeSingle<{ role: string }>();
  if (!m || (m.role !== "owner" && m.role !== "manager")) return { ok: false, error: t("errForbidden") };
  const { data: ws } = await db.from("workspaces").select("plan_code").eq("id", workspaceId).maybeSingle<{ plan_code: string | null }>();
  const plan = ws?.plan_code ? await getPlan(ws.plan_code) : null;
  if (!plan) return { ok: false, error: t("errGeneric") };
  await createPaymentOrder(workspaceId, u.user.id, plan);
  redirect(`/workspaces/new/payment?ws=${workspaceId}&return=billing`);
};
