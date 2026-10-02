// Production check of the "Tạo video" module, through the SAME server functions the workbench calls (src/lib/module-video-*.ts), with the service role.
//   NODE_OPTIONS="--require ./scripts/video-check-stubs.cjs" node scripts/with-secrets.mjs npx tsx scripts/video-module-check.cts <assetsDir> <outDir>
// Uses the test workspace "Kiểm thử · Video". Creates data named "Kiểm thử …" only. Never prints a secret.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { installModuleCore } from "@/lib/module-install";
import { addSourceFor } from "@/lib/knowledge/index";
import {
  createProject, markPublished, getProject, beginScripting, runScripting, renderProject, saveBrand, listMedia, shareToOwner, loadBrand, listProjects, updateProject, duplicateProject,
  type VideoCtx,
} from "@/lib/module-video-core";
import { approveVideo, requestRender } from "@/lib/module-video-work";
import { runTick } from "@/lib/automation-engine";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resumeWork, type EngineCtx } from "@/lib/engine";
import { MUSIC_TRACKS } from "@/lib/video/spec";

void (async () => {
const [assetsDir, outDir] = process.argv.slice(2);
if (!assetsDir || !outDir) throw new Error("usage: video-module-check.cts <assetsDir> <outDir>");
mkdirSync(outDir, { recursive: true });
const db = supabaseAdmin();
const log = (k: string, v?: unknown) => console.log(`[check] ${k}${v === undefined ? "" : `: ${typeof v === "string" ? v : JSON.stringify(v)}`}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const since = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

// ---------------------------------------------------------------- workspace and module
const NAME = "Kiểm thử · Video";
const found = (await db.from("workspaces").select("id, owner_id").eq("name", NAME).limit(1)).data?.[0] as { id: string; owner_id: string } | undefined;
if (!found) throw new Error(`workspace "${NAME}" not found`);
const ws = found.id;
log("workspace", ws);
const inst = await installModuleCore(db, { workspaceId: ws, moduleKey: "video", locale: "vi", actorName: "Kiểm thử" });
log("installed", { created: inst.created, syncQueued: inst.syncQueued });
const rules = (await db.from("authority_rules").select("action, mode").eq("workspace_id", ws).in("action", ["render_draft", "publish_video"])).data;
log("authority rules", rules);
const mode = ((await db.from("module_installations").select("operating_mode").eq("workspace_id", ws).eq("module_key", "video").single()).data as { operating_mode: string }).operating_mode;
log("operating mode", mode);

const ctx: VideoCtx = { db, ws, userId: found.owner_id, actor: "Kiểm thử" };
const eng: EngineCtx = { db, ws, actor: "Kiểm thử", locale: "vi" };

// ---------------------------------------------------------------- inputs: brand kit, media, public knowledge
const up = async (file: string, name: string, type: string): Promise<string> => {
  const path = `${ws}/${crypto.randomUUID()}-${name}`;
  const r = await db.storage.from("media").upload(path, readFileSync(join(assetsDir, file)), { contentType: type });
  if (r.error) throw new Error(`upload ${file}: ${r.error.message}`);
  return path;
};
const img1 = await up("img1.jpg", "kiem-thu-anh-1.jpg", "image/jpeg");
const img2 = await up("img2.jpg", "kiem-thu-anh-2.jpg", "image/jpeg");
const logo = await up("logo.png", "kiem-thu-logo.png", "image/png");
const brand = await saveBrand(ctx, { shopName: "Kiểm thử · Cửa hàng Lá Xanh", primary: "#16a34a", secondary: "#052e16", logoPath: logo, musicTrack: MUSIC_TRACKS[0].id, voice: "vi-VN-HoaiMyNeural" });
log("brand kit", { shop: brand.shopName, logo: Boolean(brand.logoPath), music: brand.musicTrack });
log("media listed", (await listMedia(ctx)).length);

const source = await addSourceFor(db, ws, null, {
  kind: "text", title: "Kiểm thử · Ưu đãi tháng 10", topic: "Ưu đãi", visibility: "public",
  content: [
    "Cửa hàng cây cảnh Lá Xanh chuyên cây để bàn, chậu sứ và dịch vụ chăm cây tại nhà.",
    "Ưu đãi tháng 10: giảm 15% cho đơn từ 300.000 đồng, tặng một chậu sứ nhỏ khi mua từ hai cây.",
    "Áp dụng đến hết ngày 31/10. Đặt hàng bằng cách nhắn tin cho cửa hàng.",
    "Giao hàng nội thành trong ngày. Có hướng dẫn chăm cây kèm theo mỗi đơn.",
  ].join("\n"),
});
log("knowledge source", { id: source.id, status: source.status, topic: source.topic, visibility: source.visibility });

// ---------------------------------------------------------------- 1. project + script through OpenClaw
const created = await createProject(ctx, {
  goal: "offer", aspect: "9:16", targetSeconds: 20, title: "Kiểm thử · Ưu đãi tháng 10",
  inputs: { sourceIds: [source.id], notes: "Nhấn mạnh quà tặng khi mua từ hai cây.", media: [img1, img2], auto: false },
});
log("project created", { id: created.id, status: created.status });
if (!(await beginScripting(ctx, created.id))) throw new Error("beginScripting refused");
const tScript = Date.now();
const script = await runScripting(ctx, created.id);
const scriptMs = Date.now() - tScript;
if (!script.ok) throw new Error(`script failed: ${script.error}`);
log("script (OpenClaw)", { wall_ms: scriptMs, recorded_ms: script.project.scriptMs, attempts: script.timing.attempts, openclaw_timings: script.timing.openclaw, scenes: script.project.script.length });
for (const [i, s] of script.project.script.entries()) log(`scene ${i + 1} [${s.role}]`, { caption: s.caption, voiceover: s.voiceover, visual: s.visual, media: s.media ? "yes" : "color card" });
writeFileSync(join(outDir, "script.json"), JSON.stringify(script.project.script, null, 2));

// the owner edits: rename a caption and move the last scene's media; duplicates of the project work too
const edited = script.project.script.map((s, i) => (i === 1 ? { ...s, caption: `${s.caption}`.slice(0, 60) } : s));
await updateProject(ctx, created.id, { script: edited });
const dup = await duplicateProject(ctx, created.id);
log("duplicate", { id: dup.id, title: dup.title, scenes: dup.script.length, status: dup.status });

// ---------------------------------------------------------------- 2. render through the render lane
const queued = await renderProject(ctx, created.id);
log("render queued", { status: queued.status, render: queued.render?.id });
let view = queued;
let last = "";
for (;;) {
  view = await getProject(ctx, created.id);
  const line = `${view.status} render=${view.render?.status} ${view.render?.progress ?? 0}% ${view.render?.stage ?? ""}`;
  if (line !== last) { log(`${since()} poll`, line); last = line; }
  if (view.status !== "rendering") break;
  if (Date.now() - t0 > 20 * 60_000) throw new Error("render timeout");
  await sleep(2000);
}
if (view.status !== "ready" || !view.render?.videoUrl) throw new Error(`render did not finish: ${view.status} ${view.lastError ?? ""}`);
log("render done", { duration_ms: view.render.durationMs, size_bytes: view.render.sizeBytes });
for (const [url, file] of [[view.render.videoUrl, "video.mp4"], [view.render.posterUrl, "poster.jpg"]] as const) {
  if (!url) continue;
  const res = await fetch(url);
  writeFileSync(join(outDir, file), Buffer.from(await res.arrayBuffer()));
  log(`downloaded ${file}`, res.status);
}

// ---------------------------------------------------------------- 3. approval through the gate (publish_video is ALWAYS ask)
const before = await getProject(ctx, created.id);
log("status before approval", before.status);
const item = await approveVideo(eng, created.id, { name: "Chủ kiểm thử", kind: "owner" });
log("publish_video work item", { status: item.status, decided_path: item.decided_path, reason: item.reason, evidence_state: item.evidence_state, result: item.result?.summary });
const dec = (await db.from("decisions").select("action, decided_by, decider_kind, outcome, reason").eq("work_item_id", item.id)).data;
log("decisions", dec);
const ev = (await db.from("events").select("kind, actor, summary").eq("workspace_id", ws).or(`work_item_id.eq.${item.id},kind.like.video.%`).order("created_at", { ascending: false }).limit(12)).data;
log("evidence (events)", ev);
const after = await getProject(ctx, created.id);
log("status after approval", { status: after.status, approvedBy: after.approvedByName, approvedAt: after.approvedAt });

// a second approval of the same video must not run twice
try { await approveVideo(eng, created.id, { name: "Chủ kiểm thử", kind: "owner" }); log("second approval", "UNEXPECTEDLY allowed"); } catch (e) { log("second approval refused", e instanceof Error ? e.message : String(e)); }

// ---------------------------------------------------------------- 4. share + mark published by the owner
const shared = await shareToOwner(ctx, created.id);
log("share to owner", shared);
const posted = await markPublished(ctx, created.id);
log("owner marks published", { status: posted.status, publishedAt: posted.publishedAt });

// ---------------------------------------------------------------- 5. render_draft through the gate (assist mode downgrades auto to a decision)
const rd = await requestRender(eng, dup.id);
log("render_draft work item", { status: rd.status, reason: rd.reason, decided_path: rd.decided_path });
if (rd.status === "waiting_decision") {
  const done = await resumeWork(eng, rd.id, "approved", {}, { name: "Chủ kiểm thử", kind: "owner" }, "Kiểm thử render_draft");
  log("render_draft after decision", { status: done.status, result: done.result?.summary, error: done.error });
} else log("render_draft ran by itself", { result: rd.result?.summary });
const dupAfter = await getProject(ctx, dup.id);
log("duplicate project after render_draft", { status: dupAfter.status, render: dupAfter.render?.id });

// ---------------------------------------------------------------- 6. automation "Soạn video khi có ưu đãi mới" (default OFF)
const tpl = (await db.from("automation_templates").select("key, module_key").eq("key", "video_new_offer").maybeSingle()).data;
log("automation template", tpl);
const pipe0 = (await db.from("automation_pipelines").select("id, enabled").eq("workspace_id", ws).eq("template_key", "video_new_offer").maybeSingle()).data as { id: string; enabled: boolean } | null;
log("pipeline before (default off)", pipe0 ?? "none");
await db.from("automation_pipelines").upsert({ workspace_id: ws, template_key: "video_new_offer", name: "Soạn video khi có ưu đãi mới", module_key: "video", enabled: true, config: {}, created_by: found.owner_id, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,template_key" });
const offer = await addSourceFor(db, ws, null, {
  kind: "text", title: "Kiểm thử · Ưu đãi cuối tuần", topic: "Ưu đãi", visibility: "public",
  content: "Cửa hàng Lá Xanh: cuối tuần này mua chậu cây mini giảm 20%, áp dụng thứ Bảy và Chủ nhật, nhắn tin để đặt trước.",
});
log("new offer source", offer.id);
const tick = await runTick();
log("runTick", tick);
let auto: { id: string; status: string; title: string; script: unknown } | null = null;
for (let i = 0; i < 60; i++) {
  const rows = (await db.from("video_projects").select("id, status, title, script").eq("workspace_id", ws).contains("inputs", { source_ids: [offer.id] }).limit(1)).data as Array<{ id: string; status: string; title: string; script: unknown }> | null;
  auto = rows?.[0] ?? null;
  if (auto && auto.status !== "scripting") break;
  await sleep(3000);
}
log("automation project", auto ? { id: auto.id, status: auto.status, title: auto.title, scenes: Array.isArray(auto.script) ? auto.script.length : 0 } : "none");
const notified = (await db.from("messages").select("body").eq("workspace_id", ws).like("body", "%Mình đã soạn nháp video%").order("created_at", { ascending: false }).limit(1)).data;
log("owner notified in Office", notified?.[0]?.body ?? "NO");
await runTick(); // second tick: the same source must not draft a second project
const forOffer = (await db.from("video_projects").select("id").eq("workspace_id", ws).contains("inputs", { source_ids: [offer.id] })).data?.length;
const runsForOffer = (await db.from("automation_runs").select("id, status").eq("workspace_id", ws).eq("dedupe_key", `video_offer:${offer.id}`)).data;
const forEarlier = (await db.from("video_projects").select("id").eq("workspace_id", ws).eq("inputs->>auto", "true").contains("inputs", { source_ids: [source.id] })).data?.length;
log("after 2 ticks: projects for the new offer (expect 1)", forOffer);
log("after 2 ticks: automation runs for it (expect 1)", runsForOffer);
log("source added BEFORE switching on is not drafted (expect 0)", forEarlier);
await db.from("automation_pipelines").update({ enabled: false }).eq("workspace_id", ws).eq("template_key", "video_new_offer");
log("pipeline switched back off", true);

// ---------------------------------------------------------------- summary
const list = await listProjects(ctx);
log("library", list.map((p) => ({ title: p.title, status: p.status, renders: p.renderCount })));
log("brand reload", (await loadBrand(ctx)).shopName);
log("total wall", since());

})().catch((e) => { console.error(e); process.exit(1); }).then(() => process.exit(0));
