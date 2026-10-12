"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Breadcrumbs, Button, DescriptionList, Disclosure, EmptyNotice, ListRow, Meter, PageContainer, SectionHeader, Skeleton, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { credits as dict } from "@/i18n/dict/credits";
import { buyPackAction, upgradeAction } from "./actions";
import { COLUMNS_CLASS_NAME, COLUMN_CLASS_NAME, COPY_CLASS_NAME, FIGURE_CLASS_NAME, HEAD_CLASS_NAME, PAGE_CLASS_NAME, STACK_CLASS_NAME } from "./classNames";
import { PayDrawer, type PayTarget } from "./PayDrawer";
import type { CreditsData, OrderRow, PayOrder, PlanView, UpgradeReason } from "./types";

export type CreditsViewProps = {
  /** null = skeleton mode (loading.tsx): the labels are real, figures and rows are placeholders. */
  readonly data: CreditsData | null;
};

const SKELETON_ROWS = 3;
const ORDER_TONE = { paid: "success", pending: "warning", expired: "neutral", cancelled: "neutral" } as const;

/** Credit & gói: this month's credits, top-up packs, the next plan up, and the payment history. */
export const CreditsView = ({ data }: CreditsViewProps) => {
  const t = useT(dict);
  const locale = useLocale();
  const router = useRouter();
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const credit = (n: number) => nf.format(Math.round(n));
  const money = (n: number) => `${nf.format(n)}đ`;
  const day = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: TIME_ZONE });
  const stamp = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const planName = (p: PlanView) => (locale === "vi" ? p.nameVi : p.nameEn);

  const [target, setTarget] = useState<PayTarget | null>(null);
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  /** Create the order on the server, then show its QR. The same call re-creates an expired code. */
  const begin = (next: PayTarget, isRetry: boolean) => {
    const key = next.kind === "topup" ? next.packCode : next.planCode;
    if (isRetry) setRegenError(null);
    else { setError(null); setBusy(key); }
    start(async () => {
      const res = await (next.kind === "topup" ? buyPackAction(next.packCode) : upgradeAction(next.planCode));
      setBusy(null);
      if (res.ok) {
        setTarget(next);
        setOrder(res.data);
      } else if (isRetry) setRegenError(res.error);
      else setError(res.error);
    });
  };
  const close = () => { setTarget(null); setOrder(null); setRegenError(null); };
  const onPaid = useCallback(() => router.refresh(), [router]);

  const crumbs = [{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "credits", label: t("title") }];
  const header = (
    <div className={HEAD_CLASS_NAME}>
      <Breadcrumbs label={t("crumbLabel")} items={crumbs} />
      <SectionHeader level={1} title={t("title")} description={t("description")} action={<Button variant="secondary" href="#payments">{t("historyAction")}</Button>} />
    </div>
  );

  if (!data) return <CreditsSkeleton header={header} />;

  const { plan, used, limit, topup } = data;
  const exhausted = limit !== null && used >= limit;
  const leftPct = limit !== null && limit > 0 ? Math.floor(((limit - used) / limit) * 100) : 0;
  // "Còn N%" only under 20% of the monthly allowance, and a different (negative) badge once it is used up.
  const lowOn = limit !== null && limit > 0 && !exhausted && leftPct < 20;
  const planLabel = plan ? planName(plan) : "";
  const figure = limit === null
    ? t(plan ? "balanceUnlimited" : "balanceNoPlan", { used: credit(used), plan: planLabel })
    : plan ? t("balanceFigure", { used: credit(used), limit: credit(limit), plan: planLabel }) : `${credit(used)} / ${credit(limit)} credit`;

  const reasonText = (r: UpgradeReason, next: PlanView): string =>
    r.kind === "topups" ? t("reasonTopups", { credits: credit(r.credits), plan: planName(next), saving: money(r.saving) })
      : r.kind === "cheaper" ? t("reasonCheaper", { pct: r.pct }) : t("reasonPlain");
  const planLine = (p: PlanView) => t("planLine", { credits: p.credits === null ? "∞" : credit(p.credits), per: money(p.perCredit), seats: p.seats });
  const orderTitle = (o: OrderRow) => {
    const p = [...data.plans, ...(data.contact?.plan ? [data.contact.plan] : [])].find((x) => x.code === o.planCode);
    const name = p ? planName(p) : o.planCode;
    return o.kind === "topup" ? t("orderTopup", { credits: o.packCredits === null ? "" : credit(o.packCredits) }) : o.kind === "upgrade" ? t("orderUpgrade", { plan: name }) : t("orderPlan", { plan: name });
  };
  const orderStatus = { pending: t("orderPending"), paid: t("orderPaid"), expired: t("orderExpired"), cancelled: t("orderCancelled") };

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        {header}
        {data.canBuy ? null : <Alert tone="informative" title={t("staffNote")} />}
        {error ? <Alert tone="negative" title={t("errGeneric")} description={error} dismissLabel={t("close")} onDismiss={() => setError(null)} /> : null}

        <SurfaceCard label={t("balanceLabel")} headingLevel={2}>
          <div className={STACK_CLASS_NAME}>
            <div className={FIGURE_CLASS_NAME}>
              <Text size="metric-lead" weight="semibold">{figure}</Text>
              {exhausted ? <Badge tone="danger">{topup > 0 ? t("exhaustedTopup") : t("exhausted")}</Badge> : lowOn ? <Badge tone="warning">{t("leftPct", { pct: Math.max(0, leftPct) })}</Badge> : null}
            </div>
            {limit !== null ? (
              <Meter label={t("meterLabel")} value={Math.min(used, limit)} minValue={0} maxValue={Math.max(limit, 1)} valueLabel={t("meterValue", { used: credit(used), limit: credit(limit) })} tone="neutral" />
            ) : null}
            <DescriptionList
              layout="columns"
              isDivided
              items={[
                {
                  id: "topup",
                  term: t("termTopup"),
                  description: <Text weight="semibold">{topup > 0 && data.topupExpires ? t("topupExpires", { n: credit(topup), date: day.format(new Date(data.topupExpires)) }) : t("topupValue", { n: credit(topup) })}</Text>,
                },
                { id: "forecast", term: t("termForecast"), description: <Text weight="semibold">{data.runout ? day.format(new Date(`${data.runout}T00:00:00Z`)) : t("none")}</Text> },
                { id: "carried", term: t("termCarried"), description: <Text weight="semibold">{data.carried > 0 ? t("creditUnit", { n: credit(data.carried) }) : t("none")}</Text> },
              ]}
            />
          </div>
        </SurfaceCard>

        <div className={COLUMNS_CLASS_NAME}>
          <SurfaceListCard label={t("topupTitle")} headingLevel={2} fact={t("topupFact")} empty={<EmptyNotice message={t("packsEmpty")} />}>
            {data.packs.map((p) => (
              <ListRow
                key={p.code}
                title={t("packTitle", { credits: credit(p.credits) })}
                description={t("packLine", { price: money(p.price), per: money(p.perCredit) })}
                badges={p.discountPct > 0 ? <Badge tone="success">{t("packDiscount", { pct: p.discountPct })}</Badge> : undefined}
                actions={data.canBuy ? (
                  <Button variant="secondary" size="sm" isPending={busy === p.code && isPending} isDisabled={isPending && busy !== p.code} onPress={() => begin({ kind: "topup", packCode: p.code, credits: p.credits }, false)}>{t("buy")}</Button>
                ) : undefined}
              />
            ))}
          </SurfaceListCard>

          <div className={COLUMN_CLASS_NAME}>
            {data.next ? (
              <SurfaceCard label={t("upgradeTitle")} headingLevel={2} isHighlight>
                <div className={STACK_CLASS_NAME}>
                  <div className={COPY_CLASS_NAME}>
                    <Text size="metric-lead" weight="semibold">{planName(data.next.plan)}</Text>
                    <Text size="sm" tone="muted">{planLine(data.next.plan)}</Text>
                    <Text weight="semibold">{t("priceLine", { price: money(data.next.plan.price) })}</Text>
                  </div>
                  <Text>{reasonText(data.next.reason, data.next.plan)}</Text>
                  {data.canBuy ? (
                    <div>
                      <Button variant="primary" isPending={busy === data.next.plan.code && isPending} isDisabled={isPending && busy !== data.next.plan.code} onPress={() => data.next && begin({ kind: "upgrade", planCode: data.next.plan.code, planName: planName(data.next.plan), price: data.next.plan.price }, false)}>
                        {t("upgradeCta", { plan: planName(data.next.plan) })}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </SurfaceCard>
            ) : data.contact ? (
              <SurfaceCard label={t("upgradeTitle")} headingLevel={2}>
                <div className={STACK_CLASS_NAME}>
                  <div className={COPY_CLASS_NAME}>
                    <Text size="metric-lead" weight="semibold">{data.contact.plan ? planName(data.contact.plan) : t("contactTitle")}</Text>
                    <Text size="sm" tone="muted">{t("contactText")}</Text>
                  </div>
                  {data.canBuy ? <div><Button variant="secondary" href={data.contact.href} target="_blank" rel="noopener noreferrer">{t("contactCta")}</Button></div> : null}
                </div>
              </SurfaceCard>
            ) : null}

            <Disclosure title={t("allPlans")} headingLevel={3}>
              <SurfaceListCard ariaLabel={t("allPlansLabel")} depth="nested">
                {data.plans.map((p) => (
                  <ListRow
                    key={p.code}
                    title={planName(p)}
                    description={t("planRow", { price: money(p.price), credits: p.credits === null ? "∞" : credit(p.credits), per: money(p.perCredit), seats: p.seats })}
                    badges={p.code === plan?.code ? <Badge tone="neutral">{t("currentPlan")}</Badge> : undefined}
                  />
                ))}
              </SurfaceListCard>
            </Disclosure>
          </div>
        </div>

        <div id="payments">
          <SurfaceListCard label={t("paymentsTitle")} headingLevel={2} empty={<EmptyNotice message={t("paymentsEmpty")} />}>
            {data.orders.map((o) => (
              <ListRow
                key={o.id}
                title={orderTitle(o)}
                description={`${money(o.amount)} · ${t("orderMeta", { date: stamp.format(new Date(o.createdAt)), code: o.code })}`}
                badges={<Badge tone={ORDER_TONE[o.status]}>{orderStatus[o.status]}</Badge>}
              />
            ))}
          </SurfaceListCard>
        </div>
      </div>

      <PayDrawer
        target={target}
        order={order}
        bank={data.bank}
        isRegenerating={isPending}
        regenerateError={regenError}
        onRegenerate={() => target && begin(target, true)}
        onPaid={onPaid}
        onClose={close}
      />
    </PageContainer>
  );
};

/** The page in skeleton mode: the same frame and real labels, placeholders where figures and rows will be (STATE-8). */
const CreditsSkeleton = ({ header }: { readonly header: ReactNode }) => {
  const t = useT(dict);
  const rows = Array.from({ length: SKELETON_ROWS }, (_, i) => i);
  const skeletonRows = (action: boolean) => rows.map((i) => (
    <ListRow key={i} title={<Text isSkeleton>{t("loading")}</Text>} description={<Text isSkeleton size="sm">{t("loading")}</Text>} actions={action ? <Button variant="secondary" size="sm" isSkeleton>{t("buy")}</Button> : undefined} />
  ));
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME} aria-busy="true">
        {header}
        <SurfaceCard label={t("balanceLabel")} headingLevel={2}>
          <div className={STACK_CLASS_NAME}>
            <Text size="metric-lead" isSkeleton>{t("loading")}</Text>
            <Meter label={t("meterLabel")} value={0} isSkeleton />
            <DescriptionList
              layout="columns"
              isDivided
              items={[
                { id: "topup", term: t("termTopup"), description: <Text isSkeleton>{t("loading")}</Text> },
                { id: "forecast", term: t("termForecast"), description: <Text isSkeleton>{t("loading")}</Text> },
                { id: "carried", term: t("termCarried"), description: <Text isSkeleton>{t("loading")}</Text> },
              ]}
            />
          </div>
        </SurfaceCard>
        <div className={COLUMNS_CLASS_NAME}>
          <SurfaceListCard label={t("topupTitle")} headingLevel={2} fact={t("topupFact")} isLoading>{skeletonRows(true)}</SurfaceListCard>
          <div className={COLUMN_CLASS_NAME}>
            <SurfaceCard label={t("upgradeTitle")} headingLevel={2}>
              <div className={STACK_CLASS_NAME}>
                <Text size="metric-lead" isSkeleton>{t("loading")}</Text>
                <Skeleton shape="text" lines={2} />
              </div>
            </SurfaceCard>
            <Disclosure title={t("allPlans")} headingLevel={3}>
              <SurfaceListCard ariaLabel={t("allPlansLabel")} depth="nested" isLoading>{skeletonRows(false)}</SurfaceListCard>
            </Disclosure>
          </div>
        </div>
        <SurfaceListCard label={t("paymentsTitle")} headingLevel={2} isLoading>{skeletonRows(false)}</SurfaceListCard>
      </div>
    </PageContainer>
  );
};
