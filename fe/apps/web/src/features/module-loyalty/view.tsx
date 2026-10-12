"use client";

import { EmptyNotice, SurfaceCard } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import type { LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import type { LoyaltyFigures } from "@/lib/workbench-loyalty";
import { formatNumber } from "./format";
import { MembersPanel } from "./members";
import { OverviewPanel } from "./overview";
import { PendingPanel } from "./pending";
import { PromoPanel } from "./promo";
import { RewardsPanel } from "./rewards";

/** Props for {@link LoyaltyWorkbenchView}. */
export type LoyaltyWorkbenchViewProps = {
  /** Null when the programme tables could not be read: the ribbon fails in place and the only tab says so. */
  readonly data: LoyaltyWorkbenchData | null;
  readonly figures: LoyaltyFigures | null;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** `?tab=` of the route, read on the server. */
  readonly initialTab: string | null;
};

/** The loyalty workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around the five loyalty surfaces as tabs. */
export const LoyaltyWorkbenchView = ({ data, figures, dashboard, initialTab }: LoyaltyWorkbenchViewProps) => {
  const t = useT(loyalty);
  const locale = useLocale();

  if (!data || !figures) {
    return (
      <AgentDashboardFrame
        module="loyalty"
        data={dashboard}
        figures={[]}
        figuresFailed
        tabs={[{
          id: "overview",
          label: t("tab_overview"),
          content: (
            <SurfaceCard ariaLabel={t("loadFailedTitle")}>
              <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
            </SurfaceCard>
          ),
        }]}
      />
    );
  }

  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  return (
    <AgentDashboardFrame
      module="loyalty"
      data={dashboard}
      initialTab={initialTab}
      figures={[
        { id: "active", term: t("metricMembers"), description: formatNumber(figures.activeMembers, locale), meta: t("metricMembersBasis", { n: formatNumber(figures.members, locale) }) },
        { id: "issued", term: t("metricIssued"), description: t("points", { n: formatNumber(figures.pointsIssued30d, locale) }), meta: t("metricIssuedBasis") },
        { id: "redemptions", term: t("metricRedemptions"), description: formatNumber(figures.redemptions30d, locale), meta: t("metricRedemptionsBasis", { n: formatNumber(figures.pointsRedeemed30d, locale) }) },
        { id: "atRisk", term: t("metricAtRisk"), description: formatNumber(figures.atRisk, locale), meta: t("metricAtRiskBasis") },
      ]}
      tabs={[
        { id: "overview", label: t("tab_overview"), content: <OverviewPanel data={data} /> },
        { id: "members", label: t("tab_members"), content: <MembersPanel data={data} /> },
        { id: "rewards", label: t("tab_rewards"), content: <RewardsPanel data={data} /> },
        { id: "promo", label: t("tab_promo"), content: <PromoPanel data={data} /> },
        { id: "pending", label: `${t("tab_pending")}${count(data.pending.length)}`, content: <PendingPanel items={data.pending} nowIso={data.nowIso} /> },
      ]}
    />
  );
};
