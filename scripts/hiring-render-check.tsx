// Render check of the Hiring workbench: renders every panel to HTML with the REAL data of the production test workspace "Kiểm thử · Tuyển dụng"
// (server-side render only, no browser, no session) and fails on any exception or empty output. The signed-in clicks stay a manual check.
//   npx esbuild scripts/hiring-render-check.tsx --bundle --platform=node --format=esm --packages=external --jsx=automatic --alias:server-only=./scripts/server-only-stub-impl.mjs //     --alias:next/navigation=./scripts/next-nav-stub-impl.mjs --alias:next/headers=./scripts/next-misc-stub-impl.mjs --alias:next/cache=./scripts/next-misc-stub-impl.mjs //     --alias:next/server=./scripts/next-misc-stub-impl.mjs --tsconfig=tsconfig.json --outfile=scripts/.render-check.mjs && node scripts/with-secrets.mjs node scripts/.render-check.mjs
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { GrammarRoot } from "@starci/grammar/common";
import { hdb, ensureSettings, publicJobUrl, siteUrl } from "../src/lib/module-hiring-core";
import type { HiringWorkbenchData } from "../src/lib/module-hiring-queries";
import type { CandidateRow, InterviewRow, JobRow, OfferRow, SettingsRow } from "../src/lib/module-hiring-shared";
import { HiringWorkbenchView } from "../src/features/module-hiring/view";
import { JobsPanel } from "../src/features/module-hiring/jobs";
import { PipelinePanel } from "../src/features/module-hiring/pipeline";
import { InterviewsPanel } from "../src/features/module-hiring/interviews";
import { OffersPanel } from "../src/features/module-hiring/offers";
import { OnboardingPanel } from "../src/features/module-hiring/onboarding";
import { SettingsPanel } from "../src/features/module-hiring/settings";
import { CandidateDrawer } from "../src/features/module-hiring/candidate";
import { ApplyForm } from "../src/features/module-hiring/public/ApplyForm";
import { Respond } from "../src/features/module-hiring/public/Respond";

let failed = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  if (!cond) failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  [${detail}]` : ""}`);
};

const main = async (): Promise<void> => {
  const db = hdb();
  const ws = ((await db.from("workspaces").select("id").eq("name", "Kiểm thử · Tuyển dụng").single()).data as { id: string }).id;
  const st = (await ensureSettings(db, ws)) as SettingsRow;
  const rows = async <T,>(t: string): Promise<Array<T>> => ((await db.from(t).select("*").eq("workspace_id", ws).order("created_at", { ascending: false })).data ?? []) as Array<T>;
  const members = ((await db.from("workspace_members").select("user_id, display_name, role").eq("workspace_id", ws).eq("status", "active")).data ?? []) as Array<{ user_id: string; display_name: string; role: string }>;
  const av = ((await db.from("hiring_availability").select("*").eq("workspace_id", ws)).data ?? []) as Array<{ member_user_id: string; weekday: number; start_min: number; end_min: number }>;
  const data: HiringWorkbenchData = {
    nowIso: new Date().toISOString(), origin: siteUrl(), settings: st,
    jobs: (await rows<JobRow>("hiring_jobs")).map((j) => ({ ...j, publicUrl: publicJobUrl(st.public_slug, j.slug) })),
    candidates: await rows<CandidateRow>("hiring_candidates"), interviews: await rows<InterviewRow>("hiring_interviews"), offers: await rows<OfferRow>("hiring_offers"),
    onboarding: ((await db.from("hiring_onboarding").select("id, candidate_id, title, done, done_at, sort").eq("workspace_id", ws)).data ?? []) as HiringWorkbenchData["onboarding"],
    members: members.map((m) => ({ userId: m.user_id, name: m.display_name, role: m.role, windows: av.filter((a) => a.member_user_id === m.user_id) })), waitingApprovals: 1, meUserId: members[0]?.user_id ?? "",
  };
  console.log(`data: ${data.jobs.length} jobs, ${data.candidates.length} candidates, ${data.interviews.length} interviews, ${data.offers.length} offers, ${data.onboarding.length} onboarding rows`);
  const render = (label: string, el: React.ReactElement, mustHave: ReadonlyArray<string> = [], minLength = 200): void => {
    try {
      const html = renderToString(createElement(GrammarRoot, null, el));
      ok(`${label} renders`, html.length > minLength && mustHave.every((m) => html.includes(m)), `${html.length} chars${mustHave.length ? `, has: ${mustHave.join(" | ")}` : ""}`);
    } catch (e) {
      ok(`${label} renders`, false, e instanceof Error ? e.message.slice(0, 200) : String(e));
    }
  };
  const cand = data.candidates[0] ?? null;
  render("workbench (header figures + first tab)", createElement(HiringWorkbenchView, { data }), ["Tin tuyển dụng", "Chờ bạn duyệt"]);
  render("workbench for a non-manager", createElement(HiringWorkbenchView, { data: null }), ["Chỉ chủ hoặc quản lý"]);
  render("workbench load failure", createElement(HiringWorkbenchView, { data: null, failed: true }), ["Chưa tải được"]);
  render("jobs tab", createElement(JobsPanel, { data, onOpenPipeline: () => {} }), ["Tạo tin mới"]);
  render("pipeline tab (board and phone list)", createElement(PipelinePanel, { data, jobId: "all", onJob: () => {}, onOpen: () => {} }), ["Mới ứng tuyển", "Đã loại"]);
  render("interviews tab (week calendar)", createElement(InterviewsPanel, { data, onOpen: () => {} }), ["Lịch phỏng vấn", "Hôm nay"]);
  render("offers tab", createElement(OffersPanel, { data, onOpen: () => {} }), ["Thư mời nhận việc"]);
  render("onboarding tab", createElement(OnboardingPanel, { data }), ["Nhận việc"]);
  render("settings tab", createElement(SettingsPanel, { data }), ["Lịch rảnh để phỏng vấn", "Giữ hồ sơ"]);
  render("candidate drawer", createElement(CandidateDrawer, { c: cand, data, onClose: () => {} }), [], 0); // an overlay: closed on the server, so only "no exception" is asserted
  const job = data.jobs[0];
  render("public apply form", createElement(ApplyForm, { ws: st.public_slug, job: job?.slug ?? "x", questions: job?.questions ?? [], availability: job?.requirements.availability ?? [], consentText: st.apply_consent_text }), ["Nộp hồ sơ", "Tôi đồng ý", "Họ và tên"]);
  render("candidate slot page controls", createElement(Respond, { kind: "slot", token: "a".repeat(32), slots: [{ start: "2026-10-05T02:00:00.000Z", label: "Thứ hai, 09:00" }] }), ["Không có giờ phù hợp"]);
  render("candidate offer page controls", createElement(Respond, { kind: "offer", token: "a".repeat(32) }), ["Tôi đồng ý nhận việc"]);
  console.log(failed === 0 ? "\nALL RENDER CHECKS PASSED" : `\n${failed} RENDER CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
void main();
