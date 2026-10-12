import { redirect } from "next/navigation";
import { Chrome } from "@/features/onboarding/Chrome";
import { PaymentPanel } from "@/features/onboarding/PaymentPanel";
import { getLocale } from "@/i18n/server";
import { getPlan, latestOpenOrder, myWorkspaces, readOrder, type PaymentOrder } from "@/lib/billing";
import { bankAccount, qrImageUrl } from "@/lib/sepay";
import { supabaseServer } from "@/lib/supabase/server";

type PaymentPageProps = { readonly searchParams: Promise<{ order?: string; ws?: string; return?: string }> };

/**
 * Step 3: pay for a workspace. `?order=<id>` shows that order; `?ws=<id>` shows the workspace's newest open order (or the
 * expired state when there is none). `?return=billing` marks a renewal of an active workspace. Console routes send
 * non-active workspaces here (see requireActiveWorkspace in src/lib/billing.ts).
 */
const PaymentPage = async ({ searchParams }: PaymentPageProps) => {
  const { order: orderId, ws, return: returnTo } = await searchParams;
  const { data } = await (await supabaseServer()).auth.getUser();
  if (!data.user) redirect("/login");

  let order: PaymentOrder | null = orderId ? await readOrder(orderId) : null;
  const workspaceId = order?.workspace_id ?? ws;
  const workspace = workspaceId ? (await myWorkspaces()).find((w) => w.id === workspaceId) : undefined;
  if (!workspace) redirect("/workspaces");
  const renewing = returnTo === "billing";
  const done = renewing ? `/workspaces/${workspace.id}/billing` : "/chat";
  if (order?.status === "paid" || (workspace.status === "active" && !renewing)) redirect(done);
  if (!order || order.status !== "pending") order = await latestOpenOrder(workspace.id);

  const plan = await getPlan(order?.plan_code ?? workspace.plan_code ?? "");
  const locale = await getLocale();
  return (
    <Chrome>
      <PaymentPanel
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        planName={plan ? (locale === "vi" ? plan.name_vi : plan.name_en) : ""}
        returnTo={done}
        bank={bankAccount()}
        order={order ? { id: order.id, code: order.order_code, amount: Number(order.amount_vnd), expiresAt: order.expires_at, qrUrl: qrImageUrl(Number(order.amount_vnd), order.order_code) } : null}
      />
    </Chrome>
  );
};

export default PaymentPage;
