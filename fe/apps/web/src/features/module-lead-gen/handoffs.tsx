"use client";

import { Badge, EmptyNotice, ListRow, SurfaceListCard, TextAction, type BadgeTone } from "@starci/grammar/common";
import { formatWhen } from "@/features/agent-dashboard";
import { useLocale, useT } from "@/i18n/client";
import { workbenchLeadGen } from "@/i18n/dict/workbenchLeadGen";
import type { WorkStatus } from "@/lib/flow-types";
import type { LeadGenHandoff } from "@/lib/workbench-lead-gen";
import { ScoreBadge } from "./parts";

const CLASSIFY_TONE: Record<WorkStatus, BadgeTone> = { queued: "neutral", done: "success", waiting_decision: "warning", rejected: "neutral", failed: "danger" };
const STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal", "won", "lost"];

/** Props for {@link HandoffsPanel}. */
export type HandoffsPanelProps = { readonly rows: ReadonlyArray<LeadGenHandoff> };

/** "Đã chuyển Sales": the leads handed over and where Sales' classify_lead work item stands. */
export const HandoffsPanel = ({ rows }: HandoffsPanelProps) => {
  const t = useT(workbenchLeadGen);
  const locale = useLocale();
  const stageName = (stage: string): string => (STAGES.includes(stage) ? t(`stage_${stage}` as "stage_new") : stage);
  return (
    <SurfaceListCard ariaLabel={t("handoffsLabel")} empty={<EmptyNotice message={t("handoffsEmptyTitle")} description={t("handoffsEmptyBody")} />}>
      {rows.map((row) => (
        <ListRow
          key={row.key}
          title={<TextAction href={row.href}>{row.name}</TextAction>}
          description={[t("stageLine", { stage: stageName(row.stage) }), formatWhen(row.at, locale)].join(" · ")}
          badges={
            <>
              <ScoreBadge score={row.score} />
              <Badge tone={row.classify ? CLASSIFY_TONE[row.classify] : "neutral"} isDot>{row.classify ? t(`classify_${row.classify}`) : t("classify_none")}</Badge>
            </>
          }
        />
      ))}
    </SurfaceListCard>
  );
};
