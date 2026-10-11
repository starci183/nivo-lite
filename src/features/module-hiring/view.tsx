"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, DescriptionList, EmptyNotice, HorizontalScrollRegion, SurfaceCard, Tabs } from "@starci/grammar/common";
import type { HiringWorkbenchData } from "@/lib/module-hiring-queries";
import { CandidateDrawer } from "./candidate";
import { PAGE_CLASS_NAME, PANEL_CLASS_NAME } from "./classNames";
import { InterviewsPanel } from "./interviews";
import { JobsPanel } from "./jobs";
import { OffersPanel } from "./offers";
import { OnboardingPanel } from "./onboarding";
import { PipelinePanel } from "./pipeline";
import { SettingsPanel } from "./settings";

type TabId = "jobs" | "candidates" | "interviews" | "offers" | "onboarding" | "settings";
const TAB_IDS: ReadonlyArray<TabId> = ["jobs", "candidates", "interviews", "offers", "onboarding", "settings"];
const isTab = (v: string | null | undefined): v is TabId => !!v && (TAB_IDS as ReadonlyArray<string>).includes(v);
const panelId = (key: string): string => `hiring-panel-${key}`;

/** Props for {@link HiringWorkbenchView}. */
export type HiringWorkbenchViewProps = { readonly data: HiringWorkbenchData | null; readonly failed?: boolean };

/** The Hiring workbench: four honest figures, then six surfaces as tabs. */
export const HiringWorkbenchView = ({ data, failed = false }: HiringWorkbenchViewProps) => {
  const [tab, setTab] = useState<TabId>("jobs");
  const [jobId, setJobId] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

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

  // ?tab= and ?c= are read once in the browser (after hydration, so server and client markup match).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tab");
    if (isTab(t)) setTab(t);
    const c = q.get("c");
    if (c) {
      setTab("candidates");
      setOpenId(c);
    }
  }, []);

  if (!data) {
    return (
      <div className={PAGE_CLASS_NAME}>
        <SurfaceCard ariaLabel="Tuyển dụng">
          {failed
            ? <EmptyNotice message="Chưa tải được Tuyển dụng" description="Dữ liệu có thể chưa sẵn sàng. Thử lại sau ít phút." />
            : <EmptyNotice message="Chỉ chủ hoặc quản lý mới xem được Tuyển dụng" description="Hồ sơ ứng viên là thông tin cá nhân nên chỉ người quản lý được xem. Hãy nhờ chủ doanh nghiệp cấp quyền." />}
        </SurfaceCard>
      </div>
    );
  }

  const open = data.jobs.filter((j) => j.status === "open").length;
  const fresh = data.candidates.filter((c) => c.stage === "applied").length;
  const now = Date.parse(data.nowIso);
  const upcoming = data.interviews.filter((i) => i.status === "confirmed" && i.slot_start && Date.parse(i.slot_start) >= now).length;
  const waiting = data.waitingApprovals;
  const count = (n: number): string => (n > 0 ? ` (${n})` : "");
  const items = [
    { id: "jobs", label: "Tin tuyển dụng" },
    { id: "candidates", label: `Ứng viên${count(fresh)}` },
    { id: "interviews", label: `Lịch phỏng vấn${count(upcoming)}` },
    { id: "offers", label: `Thư mời${count(data.offers.filter((o) => o.status === "waiting").length)}` },
    { id: "onboarding", label: `Nhận việc${count(data.candidates.filter((c) => c.stage === "hired").length)}` },
    { id: "settings", label: "Thiết lập" },
  ];
  const opened = data.candidates.find((c) => c.id === openId) ?? null;

  return (
    <div className={PAGE_CLASS_NAME}>
      <SurfaceCard ariaLabel="Số liệu tuyển dụng">
        <DescriptionList
          layout="stat-strip"
          isDivided
          items={[
            { id: "open", term: "Tin đang mở", description: String(open), meta: `${data.jobs.length} tin tất cả` },
            { id: "fresh", term: "Hồ sơ mới", description: String(fresh), meta: fresh > 0 ? <Badge tone="warning" isDot>Chưa được xét</Badge> : "Chưa được xét" },
            { id: "upcoming", term: "Phỏng vấn sắp tới", description: String(upcoming), meta: "Đã được ứng viên xác nhận" },
            { id: "waiting", term: "Chờ bạn duyệt", description: String(waiting), meta: waiting > 0 ? <Badge tone="warning" isDot>Thư mời và việc của Tuyển dụng</Badge> : "Thư mời và việc của Tuyển dụng" },
          ]}
        />
      </SurfaceCard>
      <HorizontalScrollRegion overflow="needed" isFocusable={false}>
        <Tabs label="Tuyển dụng" selectedKey={tab} items={items} inset="none" labelVisibility="always" panelId={panelId} onSelect={select} />
      </HorizontalScrollRegion>
      <div className={PANEL_CLASS_NAME} role="tabpanel" id={panelId(tab)}>
        {tab === "jobs" ? <JobsPanel data={data} onOpenPipeline={(id) => { setJobId(id); select("candidates"); }} /> : null}
        {tab === "candidates" ? <PipelinePanel data={data} jobId={jobId} onJob={setJobId} onOpen={setOpenId} /> : null}
        {tab === "interviews" ? <InterviewsPanel data={data} onOpen={(id) => { setOpenId(id); select("candidates"); }} /> : null}
        {tab === "offers" ? <OffersPanel data={data} onOpen={(id) => { setOpenId(id); select("candidates"); }} /> : null}
        {tab === "onboarding" ? <OnboardingPanel data={data} /> : null}
        {tab === "settings" ? <SettingsPanel data={data} /> : null}
      </div>
      <CandidateDrawer c={opened} data={data} onClose={() => setOpenId(null)} />
    </div>
  );
};
