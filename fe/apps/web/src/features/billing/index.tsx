import { notFound, redirect } from "next/navigation";
import { getPlan, type PaymentOrder, type WorkspaceStatus } from "@/lib/billing";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { supabaseServer } from "@/lib/supabase/server";
import { usageSummary } from "@/lib/usage";
import { BillingView, type BillingReview } from "./component";

/** /workspaces/[id]/billing (owner | manager): loads the plan, payments, transfers to review and this month's AI usage. */
export const Billing = async ({ workspaceId: wsId }: { readonly workspaceId: string }) => {
  const db = await supabaseServer();
  const user = await getAuthUser();
  if (!user) redirect("/login");
  // Independent reads, one wave (RLS limits every one of them to this person's own rows).
  const [{ data: me }, { data: ws }] = await Promise.all([
    db.from("workspace_members").select("role").eq("workspace_id", wsId).eq("user_id", user.id).eq("status", "active").maybeSingle<{ role: string }>(),
    db.from("workspaces").select("status, plan_code, paid_until").eq("id", wsId).single<{ status: WorkspaceStatus; plan_code: string | null; paid_until: string | null }>(),
  ]);
  if (!me) notFound();
  if (me.role !== "owner" && me.role !== "manager") redirect("/workspaces");
  // The usage figures are read with the service role, only after the role check above.
  const [plan, orders, usage] = await Promise.all([
    ws?.plan_code ? getPlan(ws.plan_code) : Promise.resolve(null),
    db.from("payment_orders").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(50),
    usageSummary(wsId),
  ]);
  // Only transfers tied to this workspace's own orders (RLS also limits them to owner | manager).
  const rows = (orders.data ?? []) as Array<PaymentOrder>;
  const orderIds = rows.map((o) => o.id);
  const review = orderIds.length
    ? await db.from("sepay_transactions").select("id, status, transfer_amount, received_at, content").in("matched_order_id", orderIds).in("status", ["underpaid", "expired", "unmatched"]).order("received_at", { ascending: false }).limit(50)
    : { data: [] as Array<BillingReview> };

  return (
    <BillingView
      workspaceId={wsId}
      plan={plan ? { name_vi: plan.name_vi, name_en: plan.name_en } : null}
      status={ws?.status ?? "active"}
      paidUntil={ws?.paid_until ?? null}
      orders={rows.map((o) => ({ id: o.id, amount_vnd: o.amount_vnd, created_at: o.created_at, plan_code: o.plan_code, order_code: o.order_code, status: o.status }))}
      review={(review.data ?? []) as Array<BillingReview>}
      usage={usage}
    />
  );
};
