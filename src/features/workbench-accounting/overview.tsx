"use client";

import { useState } from "react";
import { SectionHeader, Tabs, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import type { AccountingWorkbench, Measure, PeriodKey, WeekBar } from "@/lib/workbench-accounting";
import {
  BAR_COLUMN_CLASS_NAME, BAR_LABELS_CLASS_NAME, BAR_LIVE_CLASS_NAME, BAR_SIM_CLASS_NAME, BAR_STACK_CLASS_NAME, BARS_CLASS_NAME, BLOCK_CLASS_NAME,
  BLOCK_HEAD_CLASS_NAME, LEGEND_CLASS_NAME, MEASURE_CLASS_NAME, MEASURE_GRID_CLASS_NAME, MEASURE_VALUE_CLASS_NAME, PANEL_CLASS_NAME, SWATCH_CLASS_NAME,
} from "./classNames";
import { formatDay, formatMoney, formatMonth } from "./format";

type MeasureCellProps = {
  readonly label: string;
  readonly hint: string;
  readonly source: string;
  readonly measure: Measure;
  readonly unit: "countInvoices" | "countPayments";
};

/** One figure: the real amount large, the simulated amount beside it (never added), and where it comes from. */
const MeasureCell = ({ label, hint, source, measure, unit }: MeasureCellProps) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  return (
    <div className={MEASURE_CLASS_NAME}>
      <Text size="sm" weight="semibold">{label}</Text>
      <Text size="xs" tone="muted">{hint}</Text>
      <p className={MEASURE_VALUE_CLASS_NAME}>{formatMoney(measure.vnd.live, locale)}</p>
      <Text size="xs" tone="muted">{`${t("originLive")} · ${t(unit, { n: measure.count.live })}`}</Text>
      <Text size="xs" tone="muted">{`${t("originSimulated")}: ${formatMoney(measure.vnd.simulated, locale)} · ${t(unit, { n: measure.count.simulated })}`}</Text>
      <Text size="xs" tone="muted">{`${t("sourceLabel")}: ${source}`}</Text>
    </div>
  );
};

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
          <div key={w.startIso} className="min-w-0 flex-1">
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
        <div className={MEASURE_GRID_CLASS_NAME}>
          <MeasureCell label={t("mIncome")} hint={t("mIncomeHint")} source={t("mIncomeSource")} measure={p.income} unit="countInvoices" />
          <MeasureCell label={t("mReceivable")} hint={t("mReceivableHint")} source={t("mReceivableSource")} measure={p.receivable} unit="countInvoices" />
          <MeasureCell label={t("mUnmatched")} hint={t("mUnmatchedHint")} source={t("mUnmatchedSource")} measure={p.unmatched} unit="countPayments" />
          <div className={MEASURE_CLASS_NAME}>
            <Text size="sm" weight="semibold">{t("mWaiting")}</Text>
            <Text size="xs" tone="muted">{t("mWaitingHint")}</Text>
            <p className={MEASURE_VALUE_CLASS_NAME}>{data.waiting.count.live}</p>
            <Text size="xs" tone="muted">{t("originLive")}</Text>
            <Text size="xs" tone="muted">{`${t("originSimulated")}: ${data.waiting.count.simulated}`}</Text>
            <Text size="xs" tone="muted">
              {data.waiting.knownVnd > 0 ? `${t("waitingAmount", { amount: formatMoney(data.waiting.knownVnd, locale) })} · ` : ""}
              {`${t("sourceLabel")}: ${t("mWaitingSource")}`}
            </Text>
            {waitingTotal > 0 ? <Text as="span" size="xs" weight="medium"><button type="button" className="cursor-pointer text-left underline" onClick={onOpenQuestions}>{t("openQuestions")}</button></Text> : null}
          </div>
        </div>
        {data.excludedTest > 0 ? <Text size="xs" tone="muted">{t("excludedTest", { n: data.excludedTest })}</Text> : null}
      </section>

      <section className={BLOCK_CLASS_NAME} aria-label={t("trendTitle")}>
        <SectionHeader level={2} title={t("trendTitle")} description={t("trendIntro")} />
        <Trend weeks={p.weeks} />
        <div className={LEGEND_CLASS_NAME}>
          <Text size="xs" tone="muted"><span className={`${SWATCH_CLASS_NAME} bg-foreground`} /> {t("originLive")}</Text>
          <Text size="xs" tone="muted"><span className={`${SWATCH_CLASS_NAME} bg-muted opacity-40`} /> {t("originSimulated")}</Text>
          <Text size="xs" tone="muted">{`${t("sourceLabel")}: ${t("mIncomeSource")}`}</Text>
        </div>
      </section>
    </div>
  );
};
