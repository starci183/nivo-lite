"use client";

import { useRouter } from "next/navigation";
import { Alert, DescriptionList, Heading, List, ListItem, Meter, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { billing } from "@/i18n/dict/billing";
import { listModules, pick } from "@/lib/module-registry";
import type { UsageSummary } from "@/lib/usage";
import { WARN_AT } from "@/lib/usage-shared";
import {
  BAR_CLASS_NAME, BAR_SLOT_CLASS_NAME, CHART_AXIS_CLASS_NAME, CHART_CLASS_NAME, MODULE_LIST_CLASS_NAME, MODULE_ROW_CLASS_NAME,
  STACK_CLASS_NAME, USAGE_BLOCK_CLASS_NAME,
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
 * "Mức dùng AI" (owner | manager; the page already checked the role): this month's credits against the plan's allowance, the credits
 * left, the split by module and a daily credit chart. The model cost in USD stays internal (the team console shows it).
 */
export const UsageCard = ({ usage }: { readonly usage: UsageSummary }) => {
  const t = useT(billing);
  const locale = useLocale();
  const router = useRouter();
  const nf = new Intl.NumberFormat(intlLocale(locale));
  const { status } = usage;
  const level = status?.level ?? "ok";
  const moduleLabel: Record<string, string> = {
    // every module of the registry, then the non-module usage buckets
    ...Object.fromEntries(listModules().map((m) => [m.key, pick(m.shortName, locale)])),
    setup: t("modSetup"), office: t("modOffice"), knowledge: t("modKnowledge"), other: t("modOther"),
  };
  const byDay = new Map(usage.daily.map((d) => [d.day, d.credits]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  const days = status ? daysBetween(status.periodStart, today) : [];
  const peak = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0));
  const credit = (n: number) => nf.format(Math.round(n));
  const reading = (used: number, limit: number | null) => (limit === null ? t("usageUnlimited", { used: nf.format(used) }) : t("usageOf", { used: nf.format(used), limit: nf.format(limit) }));

  return (
    <SurfaceCard label={t("usageTitle")} headingLevel={2}>
      <div className={STACK_CLASS_NAME}>
        <Text size="sm" tone="muted">{t("usageText")}</Text>
        {level === "exceeded" ? <Alert tone="negative" title={t("usageExceeded")} action={{ label: t("usageOpenCredits"), onAction: () => router.push("/billing") }} /> : null}
        {level === "warn" ? <Alert tone="cautionary" title={t("usageWarn", { pct: Math.round((status?.ratio ?? 0) * 100) })} action={{ label: t("usageOpenCredits"), onAction: () => router.push("/billing") }} /> : null}
        {status ? (
          <>
            <div className={USAGE_BLOCK_CLASS_NAME}>
              <Meter
                label={t("usageCredits")}
                value={status.creditsLimit === null ? 0 : Math.min(status.creditsUsed, status.creditsLimit)}
                minValue={0}
                maxValue={status.creditsLimit ?? 1}
                valueLabel={reading(Math.round(status.creditsUsed), status.creditsLimit)}
                tone={toneOf(status.creditsUsed, status.creditsLimit)}
              />
              {status.messagesLimit === null ? null : (
                <Meter
                  label={t("usageMessages")}
                  value={Math.min(status.messagesUsed, status.messagesLimit)}
                  minValue={0}
                  maxValue={status.messagesLimit}
                  valueLabel={reading(status.messagesUsed, status.messagesLimit)}
                  tone={toneOf(status.messagesUsed, status.messagesLimit)}
                />
              )}
            </div>
            <DescriptionList
              layout="columns"
              isDivided
              items={[
                {
                  id: "left",
                  term: t("usageCreditsLeft"),
                  description: <Text weight="semibold">{status.creditsLimit === null ? t("usageNoLimit") : credit(Math.max(0, status.creditsLimit - status.creditsUsed))}</Text>,
                },
                ...(status.creditsCarried > 0
                  ? [{ id: "carried", term: t("usageCarried"), description: <Text weight="semibold">{credit(status.creditsCarried)}</Text> }]
                  : []),
                {
                  id: "period",
                  term: t("usagePeriod"),
                  description: (
                    <Text weight="semibold">
                      {new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${status.periodStart}T00:00:00Z`))}
                    </Text>
                  ),
                },
              ]}
            />
          </>
        ) : null}

        <div className={USAGE_BLOCK_CLASS_NAME}>
          <Heading level={3}>{t("usageByModule")}</Heading>
          {usage.byModule.length ? (
            <List className={MODULE_LIST_CLASS_NAME} label={t("usageByModule")}>
              {usage.byModule.map((m) => (
                <ListItem key={m.module} className={MODULE_ROW_CLASS_NAME}>
                  <Text weight="medium">{moduleLabel[m.module] ?? m.module}</Text>
                  <Text size="sm" tone="muted">{t("usageModuleLine", { calls: nf.format(m.calls), credits: credit(m.credits) })}</Text>
                </ListItem>
              ))}
            </List>
          ) : (
            <Text tone="muted">{t("usageEmpty")}</Text>
          )}
        </div>

        {days.length ? (
          <div className={USAGE_BLOCK_CLASS_NAME}>
            <Heading level={3}>{t("usageDaily")}</Heading>
            <div className={CHART_CLASS_NAME} role="img" aria-label={t("usageDailyLabel", { peak: credit(peak) })}>
              {days.map((d) => {
                const v = byDay.get(d) ?? 0;
                return (
                  <div key={d} className={BAR_SLOT_CLASS_NAME} title={`${d}: ${credit(v)}`}>
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
      </div>
    </SurfaceCard>
  );
};
