"use client";

import { useState } from "react";
import { Tabs } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import type { AccountingWorkbench } from "@/lib/workbench-accounting";
import { WORKBENCH_CLASS_NAME } from "./classNames";
import { EvidencePanel } from "./evidence";
import { LedgerPanel } from "./ledger";
import { OverviewPanel } from "./overview";
import { QuestionsPanel } from "./questions";

type SurfaceKey = "overview" | "evidence" | "questions" | "ledger";

/** The Accounting workbench: four sub-tabs over one panel. */
export const AccountingWorkbenchView = ({ data }: { readonly data: AccountingWorkbench }) => {
  const t = useT(workbenchAccounting);
  const [surface, setSurface] = useState<SurfaceKey>("overview");
  const questionCount = data.questions.length;
  return (
    <div className={WORKBENCH_CLASS_NAME}>
      <Tabs
        label={t("tabsLabel")}
        selectedKey={surface}
        inset="none"
        labelVisibility="always"
        items={[
          { id: "overview", label: t("tabOverview") },
          { id: "evidence", label: t("tabEvidence") },
          { id: "questions", label: questionCount > 0 ? `${t("tabQuestions")} (${questionCount})` : t("tabQuestions") },
          { id: "ledger", label: t("tabLedger") },
        ]}
        onSelect={(key) => setSurface(key === "evidence" || key === "questions" || key === "ledger" ? key : "overview")}
      />
      {surface === "overview" ? <OverviewPanel data={data} onOpenQuestions={() => setSurface("questions")} /> : null}
      {surface === "evidence" ? <EvidencePanel data={data} /> : null}
      {surface === "questions" ? <QuestionsPanel data={data} /> : null}
      {surface === "ledger" ? <LedgerPanel data={data} /> : null}
    </div>
  );
};
