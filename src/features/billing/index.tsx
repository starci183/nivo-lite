import { notFound, redirect } from "next/navigation";
import { Badge, Button, Heading, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { billing } from "@/i18n/dict/billing";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { getLocale, getT } from "@/i18n/server";
import { getPlan, type PaymentOrder, type WorkspaceStatus } from "@/lib/billing";
import { supabaseServer } from "@/lib/supabase/server";
import { RenewButton } from "./RenewButton";
import { FACTS_CLASS_NAME, FACT_CLASS_NAME, PAGE_CLASS_NAME, ROW_CLASS_NAME, ROWS_CLASS_NAME } from "./classNames";

type Review = { id: string; status: "underpaid" | "expired" | "unmatched"; transfer_amount: number | null; received_at: string; content: string | null };

const STATUS_TONE = { active: "success", pending_payment: "warning", past_due: "danger", cancelled: "neutral" } as const;
const ORDER_TONE = { paid: "success", pending: "warning", expired: "neutral", cancelled: "neutral" } as const;

/** /workspaces/[id]/billing (owner | manager): plan and status, payment history, renewal, transfers needing a manual look. */
export const Billing = async ({ workspaceId: wsId }: { readonly workspaceId: string }) => {
  const [t, locale, db] = await Promise.all([getT(billing), getLocale(), supabaseServer()]);
  const { data: u } = await db.auth.getUser();
  if (!u.user) redirect("/login");
  const { data: me } = await db.from("workspace_members").select("role").eq("workspace_id", wsId).eq("user_id", u.user.id).eq("status", "active").maybeSingle<{ role: string }>();
  if (!me) notFound();
  if (me.role !== "owner" && me.role !== "manager") redirect("/workspaces");
  const { data: ws } = await db.from("workspaces").select("status, plan_code, paid_until").eq("id", wsId).single<{ status: WorkspaceStatus; plan_code: string | null; paid_until: string | null }>();
  const [plan, orders] = await Promise.all([
    ws?.plan_code ? getPlan(ws.plan_code) : Promise.resolve(null),
    db.from("payment_orders").select("*").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(50),
  ]);
  // Only transfers tied to this workspace's own orders (RLS also limits them to owner | manager).
  const orderIds = ((orders.data ?? []) as Array<PaymentOrder>).map((o) => o.id);
  const review = orderIds.length
    ? await db.from("sepay_transactions").select("id, status, transfer_amount, received_at, content").in("matched_order_id", orderIds).in("status", ["underpaid", "expired", "unmatched"]).order("received_at", { ascending: false }).limit(50)
    : { data: [] as Array<Review> };
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const day = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long", timeZone: TIME_ZONE });
  const money = (n: number | null) => `${new Intl.NumberFormat(intlLocale(locale)).format(Number(n ?? 0))} ₫`;
  const status = ws?.status ?? "active";
  const statusLabel = { pending_payment: t("statusPending_payment"), active: t("statusActive"), past_due: t("statusPast_due"), cancelled: t("statusCancelled") }[status];
  const orderLabel = { pending: t("orderPending"), paid: t("orderPaid"), expired: t("orderExpired"), cancelled: t("orderCancelled") };
  const reviewLabel = { underpaid: t("reviewUnderpaid"), expired: t("reviewExpired"), unmatched: t("reviewUnmatched") };
  const rows = (orders.data ?? []) as Array<PaymentOrder>;
  const toReview = (review.data ?? []) as Array<Review>;

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <div><Button variant="outline" size="sm" href="/workspaces">{t("allWorkspaces")}</Button></div>
        <SectionHeader level={1} title={t("pageTitle")} description={t("pageText")} />
        <SurfaceCard label={t("currentPlan")} headingLevel={2}>
          <div className={FACTS_CLASS_NAME}>
            <div className={FACT_CLASS_NAME}>
              <Text size="sm" tone="muted">{t("currentPlan")}</Text>
              <Text weight="semibold">{plan ? (locale === "vi" ? plan.name_vi : plan.name_en) : t("noPlan")}</Text>
            </div>
            <div className={FACT_CLASS_NAME}>
              <Text size="sm" tone="muted">{t("status")}</Text>
              <Badge tone={STATUS_TONE[status]} isDot>{statusLabel}</Badge>
            </div>
            <div className={FACT_CLASS_NAME}>
              <Text size="sm" tone="muted">{t("paidUntil")}</Text>
              <Text weight="semibold">{ws?.paid_until ? day.format(new Date(ws.paid_until)) : t("notPaid")}</Text>
            </div>
          </div>
          {plan ? (
            <div className={FACTS_CLASS_NAME}>
              <RenewButton workspaceId={wsId} />
              <Text size="sm" tone="muted">{t("renewHint")}</Text>
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard label={t("history")} headingLevel={2}>
          {rows.length ? (
            <ul className={ROWS_CLASS_NAME}>
              {rows.map((o) => (
                <li key={o.id} className={ROW_CLASS_NAME}>
                  <div>
                    <Text weight="medium">{money(o.amount_vnd)}</Text>
                    <Text size="sm" tone="muted">{`${fmt.format(new Date(o.created_at))} · ${o.plan_code} · ${o.order_code}`}</Text>
                  </div>
                  <Badge tone={ORDER_TONE[o.status]}>{orderLabel[o.status]}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Text tone="muted">{t("noHistory")}</Text>
          )}
        </SurfaceCard>

        <SurfaceCard label={t("review")} headingLevel={2}>
          <Text size="sm" tone="muted">{t("reviewText")}</Text>
          {toReview.length ? (
            <ul className={ROWS_CLASS_NAME}>
              {toReview.map((r) => (
                <li key={r.id} className={ROW_CLASS_NAME}>
                  <div>
                    <Heading level={4}>{reviewLabel[r.status]}</Heading>
                    <Text size="sm" tone="muted">{t("reviewReceived", { amount: money(r.transfer_amount), date: fmt.format(new Date(r.received_at)) })}</Text>
                    {r.content ? <Text size="sm"><code>{r.content}</code></Text> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Text tone="muted">{t("noReview")}</Text>
          )}
        </SurfaceCard>
      </div>
    </PageContainer>
  );
};
