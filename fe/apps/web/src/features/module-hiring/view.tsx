"use client";

import { useEffect, useState } from "react";
import type { DescriptionListStatItem } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import type { HiringWorkbenchData } from "@/lib/module-hiring-queries";
import { CandidateDrawer } from "./candidate";
import { InterviewsPanel } from "./interviews";
import { JobsPanel } from "./jobs";
import { OffersPanel } from "./offers";
import { OnboardingPanel } from "./onboarding";
import { PipelinePanel } from "./pipeline";
import { SettingsPanel } from "./settings";

type TabId = "jobs" | "candidates" | "interviews" | "offers" | "onboarding" | "settings";
const TAB_IDS: ReadonlyArray<TabId> = ["jobs", "candidates", "interviews", "offers", "onboarding", "settings"];
const isTab = (v: string | null | undefined): v is TabId => !!v && (TAB_IDS as ReadonlyArray<string>).includes(v);

/** Props for {@link HiringWorkbenchView}. */
export type HiringWorkbenchViewProps = {
  readonly data: HiringWorkbenchData;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** The tab named in `?tab=`, already read on the server. */
  readonly initialTab: string | null;
};

/** The Hiring workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around the six Hiring surfaces as tabs. */
export const HiringWorkbenchView = ({ data, dashboard, initialTab }: HiringWorkbenchViewProps) => {
  const t = useT(workbenchFigures);
  const [tab, setTab] = useState<TabId>(isTab(initialTab) ? initialTab : "jobs");
  const [jobId, setJobId] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // ?c= (a candidate to open) is read once in the browser, after hydration, so server and client markup match.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) {
      setTab("candidates");
      setOpenId(c);
    }
  }, []);

  /** Move to a tab from inside a panel (the frame writes ?tab= itself only when its own strip is used). */
  const go = (key: TabId) => {
    setTab(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url);
    } catch {
      // the address bar is a convenience only
    }
  };

  const f = data.figures;
  const fresh = data.candidates.filter((c) => c.stage === "applied").length;
  const now = Date.parse(data.nowIso);
  const upcoming = data.interviews.filter((i) => i.status === "confirmed" && i.slot_start && Date.parse(i.slot_start) >= now).length;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  const opened = data.candidates.find((c) => c.id === openId) ?? null;
  const ribbon: ReadonlyArray<DescriptionListStatItem> = f
    ? [
      { id: "roles", term: t("hrRoles"), description: String(f.openRoles), meta: t("hrRolesMeta", { n: f.totalRoles }) },
      { id: "pipeline", term: t("hrPipeline"), description: String(f.pipeline), meta: t("hrPipelineMeta") },
      { id: "interviews", term: t("hrInterviews"), description: String(f.interviewsWeek), meta: t("hrInterviewsMeta") },
      { id: "offers", term: t("hrOffers"), description: String(f.offersWaiting + f.offersSent), meta: t("hrOffersMeta", { waiting: f.offersWaiting, sent: f.offersSent }) },
    ]
    : [];

  return (
    <>
      <AgentDashboardFrame
        module="hiring"
        data={dashboard}
        figures={ribbon}
        figuresFailed={f === null}
        tab={tab}
        onTabChange={(key) => { if (isTab(key)) setTab(key); }}
        tabs={[
          { id: "jobs", label: t("hrTabJobs"), content: <JobsPanel data={data} onOpenPipeline={(id) => { setJobId(id); go("candidates"); }} /> },
          { id: "candidates", label: `${t("hrTabCandidates")}${count(fresh)}`, content: <PipelinePanel data={data} jobId={jobId} onJob={setJobId} onOpen={setOpenId} /> },
          { id: "interviews", label: `${t("hrTabInterviews")}${count(upcoming)}`, content: <InterviewsPanel data={data} onOpen={(id) => { setOpenId(id); go("candidates"); }} /> },
          { id: "offers", label: `${t("hrTabOffers")}${count(data.offers.filter((o) => o.status === "waiting").length)}`, content: <OffersPanel data={data} onOpen={(id) => { setOpenId(id); go("candidates"); }} /> },
          { id: "onboarding", label: `${t("hrTabOnboarding")}${count(data.candidates.filter((c) => c.stage === "hired").length)}`, content: <OnboardingPanel data={data} /> },
          { id: "settings", label: t("hrTabSettings"), content: <SettingsPanel data={data} /> },
        ]}
      />
      <CandidateDrawer c={opened} data={data} onClose={() => setOpenId(null)} />
    </>
  );
};
