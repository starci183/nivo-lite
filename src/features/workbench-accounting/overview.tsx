"use client";

import { useState, type ReactNode } from "react";
import { DescriptionList, SectionHeader, SurfaceCard, Tabs, Text, TextAction, type DescriptionListStatItem } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import type { AccountingWorkbench, Measure, PeriodKey, WeekBar } from "@/lib/workbench-accounting";
import {
  BAR_COLUMN_CLASS_NAME, BAR_LABEL_CLASS_NAME, BAR_LABELS_CLASS_NAME, BAR_LIVE_CLASS_NAME, BAR_SIM_CLASS_NAME, BAR_STACK_CLASS_NAME, BARS_CLASS_NAME, BLOCK_CLASS_NAME,
  BLOCK_HEAD_CLASS_NAME, LEGEND_CLASS_NAME, MEASURE_META_CLASS_NAME, PANEL_CLASS_NAME, SWATCH_LIVE_CLASS_NAME, SWATCH_SIM_CLASS_NAME,
} from "./classNames";
import { formatDay, formatMoney, formatMonth } from "./format";

type MeasureMetaProps = {
  readonly hint: string;
  readonly lines: ReadonlyArray<string>;
  readonly action?: ReactNode;
};

/** The lines under one figure: what it counts, the live and simulated parts (never added), and where it comes from. */
const MeasureMeta = ({ hint, lines, action }: MeasureMetaProps) => (
  <div className={MEASURE_META_CLASS_NAME}>
    <Text size="xs" tone="muted">{hint}</Text>
    {lines.map((line, i) => <Text key={`${i}-${line}`} size="xs" tone="muted">{line}</Text>)}
    {action}
  </div>
);

/** Weekly income bars: live in ink, simulated light, each with its own number below. */
const Trend = ({ weeks }: { readonly weeks: ReadonlyArray<WeekBar> }) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  const max = Math.max(1, ...weeks.map((w) => w.live + w.simulated));
  return (
    <div>
      <div className={BARS_CLASS_NAME} role="img" aria-label={t("trendAria")}>
        {weeks.map((w) => (
          <div key={w.startIso} className={BAR_COLUMN_CLASS_NAME} title={`${formatDay(w.startIso, locale, false)}: ${formatMoney(w.live, locale)} / ${formatMoney(w.simulated, locale)}`}>
            <div className={BAR_STACK_CLASS_NAME}>
              <div className={BAR_SIM_CLASS_NAME} style={{ height: `${Math.round((w.simulated / max) * 128)}px` }} />
              <div className={BAR_LIVE_CLASS_NAME} style={{ height: `${Math.round((w.live / max) * 128)}px` }} />
            </div>
          </div>
        ))}
      </div>
      <div className={BAR_LABELS_CLASS_NAME}>
        {weeks.map((w) => (
          <div key={w.startIso} className={BAR_LABEL_CLASS_NAME}>
            <Text size="xs" tone="muted">{formatDay(w.startIso, locale, false)}</Text>
            <Text size="xs" weight="medium">{formatMoney(w.live, locale)}</Text>
            {w.simulated > 0 ? <Text size="xs" tone="muted">{`+ ${formatMoney(w.simulated, locale)}`}</Text> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

/** "Tổng quan kỳ": period selector, four honest measures, weekly trend. */
export const OverviewPanel = ({ data, onOpenQuestions }: { readonly data: AccountingWorkbench; readonly onOpenQuestions: () => void }) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  const [period, setPeriod] = useState<PeriodKey>("this");
  const p = data.periods[period];
  const waitingTotal = data.waiting.count.live + data.waiting.count.simulated;
  const money = (n: number) => formatMoney(n, locale);
  const moneyItem = (id: string, label: string, hint: string, source: string, measure: Measure, unit: "countInvoices" | "countPayments"): DescriptionListStatItem => ({
    id,
    term: label,
    description: money(measure.vnd.live),
    meta: (
      <MeasureMeta
        hint={hint}
        lines={[
          `${t("originLive")} · ${t(unit, { n: measure.count.live })}`,
          `${t("originSimulated")}: ${money(measure.vnd.simulated)} · ${t(unit, { n: measure.count.simulated })}`,
          `${t("sourceLabel")}: ${source}`,
        ]}
      />
    ),
  });
  const measures: ReadonlyArray<DescriptionListStatItem> = [
    moneyItem("income", t("mIncome"), t("mIncomeHint"), t("mIncomeSource"), p.income, "countInvoices"),
    moneyItem("receivable", t("mReceivable"), t("mReceivableHint"), t("mReceivableSource"), p.receivable, "countInvoices"),
    moneyItem("unmatched", t("mUnmatched"), t("mUnmatchedHint"), t("mUnmatchedSource"), p.unmatched, "countPayments"),
    {
      id: "waiting",
      term: t("mWaiting"),
      description: String(data.waiting.count.live),
      meta: (
        <MeasureMeta
          hint={t("mWaitingHint")}
          lines={[
            t("originLive"),
            `${t("originSimulated")}: ${data.waiting.count.simulated}`,
            `${data.waiting.knownVnd > 0 ? `${t("waitingAmount", { amount: money(data.waiting.knownVnd) })} · ` : ""}${t("sourceLabel")}: ${t("mWaitingSource")}`,
          ]}
          action={waitingTotal > 0 ? <TextAction size="xs" onPress={onOpenQuestions}>{t("openQuestions")}</TextAction> : undefined}
        />
      ),
    },
  ];
  return (
    <div className={PANEL_CLASS_NAME}>
      <section className={BLOCK_CLASS_NAME} aria-label={t("overviewTitle")}>
        <div className={BLOCK_HEAD_CLASS_NAME}>
          <SectionHeader level={2} title={t("overviewTitle")} description={t("overviewIntro", { month: formatMonth(p.fromIso, locale) })} />
          <Tabs
            label={t("periodLabel")}
            selectedKey={period}
            inset="none"
            labelVisibility="always"
            items={[{ id: "this", label: t("periodThis") }, { id: "last", label: t("periodLast") }]}
            onSelect={(key) => setPeriod(key === "last" ? "last" : "this")}
          />
        </div>
        <SurfaceCard ariaLabel={t("overviewTitle")}>
          <DescriptionList layout="stat-strip" isDivided items={measures} />
        </SurfaceCard>
        {data.excludedTest > 0 ? <Text size="xs" tone="muted">{t("excludedTest", { n: data.excludedTest })}</Text> : null}
      </section>

      <section className={BLOCK_CLASS_NAME} aria-label={t("trendTitle")}>
        <SectionHeader level={2} title={t("trendTitle")} description={t("trendIntro")} />
        <SurfaceCard ariaLabel={t("trendTitle")}>
          <Trend weeks={p.weeks} />
        </SurfaceCard>
        <div className={LEGEND_CLASS_NAME}>
          <Text size="xs" tone="muted" startContent={<span aria-hidden className={SWATCH_LIVE_CLASS_NAME} />}>{t("originLive")}</Text>
          <Text size="xs" tone="muted" startContent={<span aria-hidden className={SWATCH_SIM_CLASS_NAME} />}>{t("originSimulated")}</Text>
          <Text size="xs" tone="muted">{`${t("sourceLabel")}: ${t("mIncomeSource")}`}</Text>
        </div>
      </section>
    </div>
  );
};
