"use client";

import { useCallback, useEffect, useState } from "react";
import { DescriptionList, EmptyNotice, SurfaceCard, Tabs } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import { PAGE_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames";
import { formatNumber } from "./format";
import { MembersPanel } from "./members";
import { OverviewPanel } from "./overview";
import { PendingPanel } from "./pending";
import { PromoPanel } from "./promo";
import { RewardsPanel } from "./rewards";

type TabId = "overview" | "members" | "rewards" | "promo" | "pending";
const TAB_IDS: ReadonlyArray<TabId> = ["overview", "members", "rewards", "promo", "pending"];
const isTab = (key: string | null | undefined): key is TabId => !!key && (TAB_IDS as ReadonlyArray<string>).includes(key);
const panelId = (key: string): string => `loyalty-panel-${key}`;

/** The loyalty workbench: four honest figures, then five surfaces as tabs (kept in `?tab=`). */
export const LoyaltyWorkbenchView = ({ data }: { readonly data: LoyaltyWorkbenchData | null }) => {
  const t = useT(loyalty);
  const locale = useLocale();
  const [tab, setTab] = useState<TabId>("overview");

  const select = useCallback((key: string) => {
    if (!isTab(key)) return;
    setTab(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url);
    } catch {
      // the address bar is a convenience only
    }
  }, []);

  // The route does not pass ?tab=, so read it once in the browser (after hydration, so server and client markup match).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isTab(fromUrl)) setTab(fromUrl);
  }, []);

  if (!data) {
    return (
      <div className={PAGE_CLASS_NAME}>
        <SurfaceCard ariaLabel={t("loadFailedTitle")}>
          <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
        </SurfaceCard>
      </div>
    );
  }

  const s = data.stats;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  const items = [
    { id: "overview", label: t("tab_overview") },
    { id: "members", label: t("tab_members") },
    { id: "rewards", label: t("tab_rewards") },
    { id: "promo", label: t("tab_promo") },
    { id: "pending", label: `${t("tab_pending")}${count(data.pending.length)}` },
  ];

  return (
    <div className={PAGE_CLASS_NAME}>
      <SurfaceCard ariaLabel={t("metricsAria")}>
        <DescriptionList
          layout="stat-strip"
          isDivided
          items={[
            { id: "members", term: t("metricMembers"), description: formatNumber(s.members, locale), meta: t("metricMembersBasis", { n: formatNumber(s.active90d, locale) }) },
            { id: "outstanding", term: t("metricOutstanding"), description: t("points", { n: formatNumber(s.pointsOutstanding, locale) }), meta: t("metricOutstandingBasis") },
            { id: "spend", term: t("metricSpend"), description: `${formatNumber(s.spend30d, locale)} ₫`, meta: t("metricSpendBasis") },
            {
              id: "redeemed",
              term: t("metricRedeemed"),
              description: t("points", { n: formatNumber(s.redeemed30d, locale) }),
              meta: t("metricRedeemedBasis", { n: s.redemptions30d, value: `${formatNumber(s.rewardValue30d, locale)} ₫` }),
            },
          ]}
        />
      </SurfaceCard>

      <Tabs label={t("tabsLabel")} selectedKey={tab} items={items} inset="none" labelVisibility="always" panelId={panelId} onSelect={select} />

      <div className={PANEL_CLASS_NAME} role="tabpanel" id={panelId(tab)}>
        {tab === "overview" ? <OverviewPanel data={data} /> : null}
        {tab === "members" ? <MembersPanel data={data} /> : null}
        {tab === "rewards" ? <RewardsPanel data={data} /> : null}
        {tab === "promo" ? <PromoPanel data={data} /> : null}
        {tab === "pending" ? <PendingPanel items={data.pending} nowIso={data.nowIso} /> : null}
      </div>
    </div>
  );
};
