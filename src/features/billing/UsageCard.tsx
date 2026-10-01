"use client";

import { Alert, Meter, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { billing } from "@/i18n/dict/billing";
import type { UsageSummary } from "@/lib/usage";
import { WARN_AT } from "@/lib/usage-shared";
import {
  BAR_CLASS_NAME, BAR_SLOT_CLASS_NAME, CHART_AXIS_CLASS_NAME, CHART_CLASS_NAME, FACTS_CLASS_NAME, FACT_CLASS_NAME,
  MODULE_ROW_CLASS_NAME, ROWS_CLASS_NAME, USAGE_BLOCK_CLASS_NAME,
} from "./classNames";

/** How a meter reads: calm below 80%, cautionary from 80%, negative once the allowance is used up. */
const toneOf = (used: number, limit: number | null) => (limit === null || limit <= 0 ? "informative" : used >= limit ? "negative" : used / limit >= WARN_AT ? "cautionary" : "informative");

/** The days from `from` to `to` (YYYY-MM-DD, inclusive). */
const daysBetween = (from: string, to: string): Array<string> => {
  const out: Array<string> = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to && out.length < 32; d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
  return out;
};

/**
 * "Mức dùng AI" (owner | manager; the page already checked the role): this month's customer replies and tokens against the plan's allowance,
 * the estimated cost, the split by module and a daily token chart.
 */
export const UsageCard = ({ usage }: { readonly usage: UsageSummary }) => {
  const t = useT(billing);
  const locale = useLocale();
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const { status } = usage;
  const level = status?.level ?? "ok";
  const moduleLabel: Record<string, string> = {
    chatbot: t("modChatbot"), sales: t("modSales"), accounting: t("modAccounting"), setup: t("modSetup"), office: t("modOffice"), knowledge: t("modKnowledge"), other: t("modOther"),
  };
  const byDay = new Map(usage.daily.map((d) => [d.day, d.tokens]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  const days = status ? daysBetween(status.periodStart, today) : [];
  const peak = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0));
  const usd = (n: number) => `$${n.toFixed(n >= 1 ? 2 : 4)}`;
  const reading = (used: number, limit: number | null) => (limit === null ? t("usageUnlimited", { used: nf.format(used) }) : t("usageOf", { used: nf.format(used), limit: nf.format(limit) }));

  return (
    <SurfaceCard label={t("usageTitle")} headingLevel={2}>
      <Text size="sm" tone="muted">{t("usageText")}</Text>
      {level === "exceeded" ? <Alert tone="negative" title={t("usageExceeded")} /> : null}
      {level === "warn" ? <Alert tone="cautionary" title={t("usageWarn", { pct: Math.round((status?.ratio ?? 0) * 100) })} /> : null}
      {status ? (
        <>
          <div className={USAGE_BLOCK_CLASS_NAME}>
            <Meter
              label={t("usageMessages")}
              value={status.messagesLimit === null ? 0 : Math.min(status.messagesUsed, status.messagesLimit)}
              minValue={0}
              maxValue={status.messagesLimit ?? 1}
              valueLabel={reading(status.messagesUsed, status.messagesLimit)}
              tone={toneOf(status.messagesUsed, status.messagesLimit)}
            />
            <Meter
              label={t("usageTokens")}
              value={status.tokensLimit === null ? 0 : Math.min(status.tokensUsed, status.tokensLimit)}
              minValue={0}
              maxValue={status.tokensLimit ?? 1}
              valueLabel={reading(status.tokensUsed, status.tokensLimit)}
              tone={toneOf(status.tokensUsed, status.tokensLimit)}
            />
          </div>
          <div className={FACTS_CLASS_NAME}>
            <div className={FACT_CLASS_NAME}>
              <Text size="sm" tone="muted">{t("usageCost")}</Text>
              <Text weight="semibold">{usd(status.costUsd)}</Text>
            </div>
            <div className={FACT_CLASS_NAME}>
              <Text size="sm" tone="muted">{t("usagePeriod")}</Text>
              <Text weight="semibold">{new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${status.periodStart}T00:00:00Z`))}</Text>
            </div>
          </div>
        </>
      ) : null}

      <Text weight="medium">{t("usageByModule")}</Text>
      {usage.byModule.length ? (
        <ul className={ROWS_CLASS_NAME}>
          {usage.byModule.map((m) => (
            <li key={m.module} className={MODULE_ROW_CLASS_NAME}>
              <Text weight="medium">{moduleLabel[m.module] ?? m.module}</Text>
              <Text size="sm" tone="muted">{t("usageModuleLine", { calls: nf.format(m.calls), tokens: nf.format(m.tokens), cost: usd(m.costUsd) })}</Text>
            </li>
          ))}
        </ul>
      ) : (
        <Text tone="muted">{t("usageEmpty")}</Text>
      )}

      {days.length ? (
        <div className={USAGE_BLOCK_CLASS_NAME}>
          <Text weight="medium">{t("usageDaily")}</Text>
          <div className={CHART_CLASS_NAME} role="img" aria-label={t("usageDailyLabel", { peak: nf.format(peak) })}>
            {days.map((d) => {
              const v = byDay.get(d) ?? 0;
              return (
                <div key={d} className={BAR_SLOT_CLASS_NAME} title={`${d}: ${nf.format(v)}`}>
                  <div className={BAR_CLASS_NAME} style={{ height: `${v > 0 ? Math.max(4, Math.round((v / peak) * 100)) : 0}%` }} />
                </div>
              );
            })}
          </div>
          <div className={CHART_AXIS_CLASS_NAME}>
            <Text size="sm" tone="muted">{days[0]?.slice(8)}</Text>
            <Text size="sm" tone="muted">{days.at(-1)?.slice(8)}</Text>
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
};
