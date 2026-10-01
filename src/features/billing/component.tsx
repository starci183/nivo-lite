"use client";

import { Badge, Button, Heading, PageContainer, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { billing } from "@/i18n/dict/billing";
import type { UsageSummary } from "@/lib/usage";
import { RenewButton } from "./RenewButton";
import { UsageCard } from "./UsageCard";
import { FACTS_CLASS_NAME, FACT_CLASS_NAME, PAGE_CLASS_NAME, ROW_CLASS_NAME, ROWS_CLASS_NAME } from "./classNames";

export type BillingOrder = { readonly id: string; readonly amount_vnd: number; readonly created_at: string; readonly plan_code: string; readonly order_code: string; readonly status: "pending" | "paid" | "expired" | "cancelled" };
export type BillingReview = { readonly id: string; readonly status: "underpaid" | "expired" | "unmatched"; readonly transfer_amount: number | null; readonly received_at: string; readonly content: string | null };
export type BillingViewProps = {
  readonly workspaceId: string;
  readonly plan: { readonly name_vi: string; readonly name_en: string } | null;
  readonly status: "pending_payment" | "active" | "past_due" | "cancelled";
  readonly paidUntil: string | null;
  readonly orders: ReadonlyArray<BillingOrder>;
  readonly review: ReadonlyArray<BillingReview>;
  readonly usage: UsageSummary;
};

const STATUS_TONE = { active: "success", pending_payment: "warning", past_due: "danger", cancelled: "neutral" } as const;
const ORDER_TONE = { paid: "success", pending: "warning", expired: "neutral", cancelled: "neutral" } as const;

/** /workspaces/[id]/billing (owner | manager): plan and status, AI usage, payment history, renewal, transfers needing a manual look. */
export const BillingView = ({ workspaceId: wsId, plan, status, paidUntil, orders, review, usage }: BillingViewProps) => {
  const t = useT(billing);
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const day = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "long", timeZone: TIME_ZONE });
  const money = (n: number | null) => `${new Intl.NumberFormat(intlLocale(locale)).format(Number(n ?? 0))} ₫`;
  const statusLabel = { pending_payment: t("statusPending_payment"), active: t("statusActive"), past_due: t("statusPast_due"), cancelled: t("statusCancelled") }[status];
  const orderLabel = { pending: t("orderPending"), paid: t("orderPaid"), expired: t("orderExpired"), cancelled: t("orderCancelled") };
  const reviewLabel = { underpaid: t("reviewUnderpaid"), expired: t("reviewExpired"), unmatched: t("reviewUnmatched") };

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
              <Text weight="semibold">{paidUntil ? day.format(new Date(paidUntil)) : t("notPaid")}</Text>
            </div>
          </div>
          {plan ? (
            <div className={FACTS_CLASS_NAME}>
              <RenewButton workspaceId={wsId} />
              <Text size="sm" tone="muted">{t("renewHint")}</Text>
            </div>
          ) : null}
        </SurfaceCard>

        <UsageCard usage={usage} />

        <SurfaceCard label={t("history")} headingLevel={2}>
          {orders.length ? (
            <ul className={ROWS_CLASS_NAME}>
              {orders.map((o) => (
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
          {review.length ? (
            <ul className={ROWS_CLASS_NAME}>
              {review.map((r) => (
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
