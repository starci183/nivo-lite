"use client";

import { useState } from "react";
import type { DescriptionListStatItem } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useLocale, useT } from "@/i18n/client";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import type { AccountingWorkbench, Measure } from "@/lib/workbench-accounting";
import { EvidencePanel } from "./evidence";
import { formatMoney } from "./format";
import { LedgerPanel } from "./ledger";
import { OverviewPanel } from "./overview";
import { QuestionsPanel } from "./questions";

type SurfaceKey = "overview" | "evidence" | "questions" | "ledger";
const SURFACES: ReadonlyArray<SurfaceKey> = ["overview", "evidence", "questions", "ledger"];
const isSurface = (key: string | null | undefined): key is SurfaceKey => !!key && (SURFACES as ReadonlyArray<string>).includes(key);

/** Props for {@link AccountingWorkbenchView}. */
export type AccountingWorkbenchViewProps = {
  readonly data: AccountingWorkbench;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** The tab named in `?tab=`, already read on the server. */
  readonly initialTab: string | null;
};

/** The Accounting workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around the four Accounting surfaces as tabs. */
export const AccountingWorkbenchView = ({ data, dashboard, initialTab }: AccountingWorkbenchViewProps) => {
  const t = useT(workbenchAccounting);
  const locale = useLocale();
  const [surface, setSurface] = useState<SurfaceKey>(isSurface(initialTab) ? initialTab : "overview");
  const questionCount = data.questions.length;
  const money = (n: number) => formatMoney(n, locale);
  const period = data.periods.this;

  /** One money figure of the ribbon: live money (never added to simulated), then its count and, when there is any, the simulated part. */
  const moneyItem = (id: string, term: string, measure: Measure, unit: "countInvoices" | "countPayments"): DescriptionListStatItem => ({
    id,
    term,
    description: money(measure.vnd.live),
    meta: [t(unit, { n: measure.count.live }), measure.count.simulated > 0 ? `${t("originSimulated")}: ${money(measure.vnd.simulated)}` : ""].filter(Boolean).join(" · "),
  });
  const { d0, d30, d60 } = data.ageing;
  const simulatedOpen = d0.vnd.simulated + d30.vnd.simulated + d60.vnd.simulated;

  return (
    <AgentDashboardFrame
      module="accounting"
      data={dashboard}
      figures={[
        moneyItem("income", t("mIncome"), period.income, "countInvoices"),
        moneyItem("receivable", t("mReceivable"), period.receivable, "countInvoices"),
        moneyItem("unmatched", t("mUnmatched"), period.unmatched, "countPayments"),
        {
          id: "ageing",
          term: t("mAgeing"),
          description: `${d0.count.live} / ${d30.count.live} / ${d60.count.live}`,
          meta: [`${money(d0.vnd.live)} · ${money(d30.vnd.live)} · ${money(d60.vnd.live)}`, simulatedOpen > 0 ? `${t("originSimulated")}: ${money(simulatedOpen)}` : ""].filter(Boolean).join(" · "),
        },
      ]}
      tab={surface}
      onTabChange={(key) => setSurface(isSurface(key) ? key : "overview")}
      tabs={[
        { id: "overview", label: t("tabOverview"), content: <OverviewPanel data={data} onOpenQuestions={() => setSurface("questions")} /> },
        { id: "evidence", label: t("tabEvidence"), content: <EvidencePanel data={data} /> },
        { id: "questions", label: questionCount > 0 ? `${t("tabQuestions")} (${questionCount})` : t("tabQuestions"), content: <QuestionsPanel data={data} /> },
        { id: "ledger", label: t("tabLedger"), content: <LedgerPanel data={data} /> },
      ]}
    />
  );
};
