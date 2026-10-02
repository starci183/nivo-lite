import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvidence } from "./core";
import { resolveBotToken, type Connection } from "./channels";
import { buildAgentContext } from "./knowledge/index";
import { generateWithOpenClaw, type GenMessage } from "./openclaw-generate";
import { telegramSend } from "./telegram";
import { enqueueRender, getRender, signedRenderUrls } from "./video/client";
import { createMediaUpload, signedMediaUrl } from "./video/media";
import { ASPECTS, MEDIA_BUCKET, validateVideoSpec, type Aspect, type RenderRow } from "./video/spec";
import {
  DEFAULT_BRAND, EMPTY_INPUTS, buildVideoSpec, estimateScriptSeconds, isGoal, mediaKindOf, mediaLabel, parseScriptOutput, readInputs, readScript, templateOf, writeInputs,
  type Brand, type Goal, type MediaItem, type ProjectInputs, type ProjectStatus, type ProjectView, type RenderView, type ScriptScene, type SourceChoice,
} from "./module-video-shared";

/**
 * "Tạo video": the server half. Every function takes an explicit context ({ db, ws, userId, actor }) so the same code runs from the signed-in
 * workbench (server actions), from the authority-gate performers and from the automation tick. The caller has ALREADY checked the person is a member
 * (managers for writes); `ws` scopes every query. The renderer itself is the render lane's: enqueueRender / getRender / signedRenderUrls.
 */
export type VideoCtx = { readonly db: SupabaseClient; readonly ws: string; readonly userId: string | null; readonly actor: string };

const fail = (error: { readonly message: string } | null): void => { if (error) throw new Error(error.message); };
const now = (): string => new Date().toISOString();

export type ProjectRow = {
  id: string; workspace_id: string; title: string; goal: string; aspect: string; target_seconds: number; status: ProjectStatus; inputs: unknown; script: unknown;
  current_spec: unknown; render_id: string | null; render_ids: Array<string>; version: number; script_ms: number | null; script_meta: Record<string, unknown> | null; last_error: string | null;
  source_project_id: string | null; approved_by_name: string | null; approved_at: string | null; publish_work_item_id: string | null; published_at: string | null;
  created_by: string | null; created_at: string; updated_at: string;
};

/* ------------------------------------------------------------------ brand kit */

type BrandRow = { shop_name: string; primary_color: string; secondary_color: string; logo_path: string | null; music_track: string | null; voice: string };

/** The workspace brand kit; the shop name falls back to the workspace name until the owner saves one. */
export const loadBrand = async (c: Pick<VideoCtx, "db" | "ws">): Promise<Brand> => {
  const [kit, ws] = await Promise.all([
    c.db.from("video_brand_kits").select("shop_name, primary_color, secondary_color, logo_path, music_track, voice").eq("workspace_id", c.ws).maybeSingle(),
    c.db.from("workspaces").select("name").eq("id", c.ws).maybeSingle(),
  ]);
  const r = kit.data as BrandRow | null;
  const wsName = ((ws.data as { name?: string } | null)?.name ?? "").trim();
  if (!r) return { ...DEFAULT_BRAND, shopName: wsName };
  return { shopName: r.shop_name || wsName, primary: r.primary_color, secondary: r.secondary_color, logoPath: r.logo_path, musicTrack: r.music_track, voice: r.voice };
};

export const saveBrand = async (c: VideoCtx, b: Brand): Promise<Brand> => {
  const color = (v: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : fallback);
  const logo = b.logoPath && b.logoPath.toLowerCase().startsWith(`${c.ws.toLowerCase()}/`) ? b.logoPath : null;
  const row = {
    workspace_id: c.ws, shop_name: b.shopName.trim().slice(0, 60), primary_color: color(b.primary, DEFAULT_BRAND.primary), secondary_color: color(b.secondary, DEFAULT_BRAND.secondary),
    logo_path: logo, music_track: b.musicTrack || null, voice: b.voice || DEFAULT_BRAND.voice, updated_by: c.userId,
  };
  fail((await c.db.from("video_brand_kits").upsert(row, { onConflict: "workspace_id" })).error);
  return loadBrand(c);
};

/* ------------------------------------------------------------------ inputs: public knowledge, media */

/** Public business sources the video may be based on (customer-facing output: never internal knowledge). */
export const sourceChoices = async (c: Pick<VideoCtx, "db" | "ws">): Promise<Array<SourceChoice>> => {
  const { data, error } = await c.db.from("knowledge_sources").select("id, title, topic, content").eq("workspace_id", c.ws).eq("visibility", "public").eq("status", "ready").order("created_at", { ascending: false }).limit(40);
  fail(error);
  return ((data ?? []) as Array<{ id: string; title: string; topic: string | null; content: string }>).map((r) => ({ id: r.id, title: r.title, topic: r.topic, excerpt: r.content.replace(/\s+/g, " ").trim().slice(0, 220) }));
};

/** What the workspace uploaded to the `media` bucket (newest first), with a short-lived preview URL. */
export const listMedia = async (c: Pick<VideoCtx, "db" | "ws">, limit = 60): Promise<Array<MediaItem>> => {
  const { data, error } = await c.db.storage.from(MEDIA_BUCKET).list(c.ws, { limit, sortBy: { column: "created_at", order: "desc" } });
  fail(error);
  const files = (data ?? []).filter((f) => f.id && /\.(jpe?g|png|webp|mp4|mov|webm)$/i.test(f.name));
  const paths = files.map((f) => `${c.ws}/${f.name}`);
  const signed = paths.length ? (await c.db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return paths.map((path) => ({ path, name: mediaLabel(path), kind: mediaKindOf(path), url: urlOf.get(path) ?? null }));
};

/** One-shot upload ticket for a file the browser is about to upload (the render lane's helper; path B). */
export const mediaTicket = async (c: Pick<VideoCtx, "db" | "ws">, file: { name: string; type: string; size: number }) => createMediaUpload(c.db, c.ws, file);
export const previewUrl = async (c: Pick<VideoCtx, "db">, path: string): Promise<string | null> => signedMediaUrl(c.db, path);

/* ------------------------------------------------------------------ projects */

const toView = async (c: VideoCtx, p: ProjectRow, render: RenderRow | null): Promise<ProjectView> => {
  let rv: RenderView | null = null;
  if (render) {
    const done = render.status === "done" && render.output_path;
    const urls = done ? await signedRenderUrls(c.db, render) : { videoUrl: null, posterUrl: null };
    const dl = done ? await signedRenderUrls(c.db, { output_path: render.output_path, poster_path: null }, { downloadAs: `${p.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "video"}.mp4` }) : { videoUrl: null };
    rv = {
      id: render.id, status: render.status, progress: render.progress, stage: render.stage, durationMs: render.duration_ms, sizeBytes: render.size_bytes, error: render.error,
      videoUrl: urls.videoUrl, downloadUrl: dl.videoUrl, posterUrl: urls.posterUrl,
    };
  }
  return {
    id: p.id, title: p.title, goal: isGoal(p.goal) ? p.goal : "custom", aspect: (ASPECTS as ReadonlyArray<string>).includes(p.aspect) ? (p.aspect as Aspect) : "9:16", targetSeconds: p.target_seconds,
    status: p.status, inputs: readInputs(p.inputs), script: readScript(p.script), version: p.version, scriptMs: p.script_ms, lastError: p.last_error, render: rv,
    renderCount: p.render_ids?.length ?? 0, approvedAt: p.approved_at, approvedByName: p.approved_by_name, publishedAt: p.published_at, createdAt: p.created_at, updatedAt: p.updated_at,
  };
};

const SCRIPT_STALE_MS = 5 * 60_000;

const loadRow = async (c: Pick<VideoCtx, "db" | "ws">, id: string): Promise<ProjectRow> => {
  const { data, error } = await c.db.from("video_projects").select("*").eq("workspace_id", c.ws).eq("id", id).maybeSingle();
  fail(error);
  if (!data) throw new Error("Không tìm thấy video này.");
  return data as ProjectRow;
};

const patchRow = async (c: Pick<VideoCtx, "db" | "ws">, id: string, patch: Record<string, unknown>, onlyFrom?: ReadonlyArray<ProjectStatus>): Promise<ProjectRow | null> => {
  let q = c.db.from("video_projects").update(patch).eq("workspace_id", c.ws).eq("id", id);
  if (onlyFrom) q = q.in("status", [...onlyFrom]);
  const { data, error } = await q.select("*").maybeSingle();
  fail(error);
  return (data as ProjectRow | null) ?? null;
};

/** Bring a project in line with what happened to its render (and a script that never came back), then return its view. */
export const getProject = async (c: VideoCtx, id: string): Promise<ProjectView> => {
  let p = await loadRow(c, id);
  let render: RenderRow | null = null;
  if (p.render_id) render = await getRender(c.db, c.ws, p.render_id);
  if (p.status === "rendering" && render) {
    if (render.status === "done") p = (await patchRow(c, id, { status: "ready", last_error: null }, ["rendering"])) ?? p;
    else if (render.status === "failed") p = (await patchRow(c, id, { status: "draft", last_error: `Dựng video không thành công: ${render.error ?? "lỗi không rõ"}` }, ["rendering"])) ?? p;
  } else if (p.status === "rendering" && !render) {
    p = (await patchRow(c, id, { status: "draft", last_error: "Không tìm thấy lượt dựng video." }, ["rendering"])) ?? p;
  }
  if (p.status === "scripting") {
    const started = Date.parse(String((p.script_meta ?? {}).started_at ?? p.updated_at));
    if (Number.isFinite(started) && Date.now() - started > SCRIPT_STALE_MS) p = (await patchRow(c, id, { status: "draft", last_error: "Soạn kịch bản quá lâu, bạn thử lại nhé." }, ["scripting"])) ?? p;
  }
  return toView(c, p, render);
};

export const listProjects = async (c: VideoCtx, opts: { readonly includeArchived?: boolean } = {}): Promise<Array<ProjectView>> => {
  let q = c.db.from("video_projects").select("*").eq("workspace_id", c.ws).order("updated_at", { ascending: false }).limit(60);
  if (!opts.includeArchived) q = q.neq("status", "archived");
  const { data, error } = await q;
  fail(error);
  const rows = (data ?? []) as Array<ProjectRow>;
  // One query for every render these projects point at.
  const ids = rows.map((r) => r.render_id).filter((v): v is string => Boolean(v));
  const renders = ids.length ? ((await c.db.from("video_renders").select("*").eq("workspace_id", c.ws).in("id", ids)).data ?? []) as Array<RenderRow> : [];
  const byId = new Map(renders.map((r) => [r.id, r]));
  const out: Array<ProjectView> = [];
  for (const r of rows) {
    let p = r;
    const render = r.render_id ? byId.get(r.render_id) ?? null : null;
    if (p.status === "rendering" && render?.status === "done") p = (await patchRow(c, r.id, { status: "ready", last_error: null }, ["rendering"])) ?? p;
    else if (p.status === "rendering" && render?.status === "failed") p = (await patchRow(c, r.id, { status: "draft", last_error: `Dựng video không thành công: ${render.error ?? "lỗi không rõ"}` }, ["rendering"])) ?? p;
    out.push(await toView(c, p, render));
  }
  return out;
};

export type NewProject = { readonly goal: Goal; readonly aspect: Aspect; readonly targetSeconds: number; readonly title?: string; readonly inputs?: Partial<ProjectInputs> };

export const createProject = async (c: VideoCtx, input: NewProject): Promise<ProjectView> => {
  const t = templateOf(input.goal);
  const seconds = Math.min(90, Math.max(10, Math.round(input.targetSeconds || t.default_seconds)));
  const title = (input.title ?? "").trim().slice(0, 120) || `${t.label.vi} · ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}`;
  const inputs: ProjectInputs = { ...EMPTY_INPUTS, ...(input.inputs ?? {}) };
  const { data, error } = await c.db.from("video_projects").insert({
    workspace_id: c.ws, title, goal: input.goal, aspect: input.aspect, target_seconds: seconds, inputs: writeInputs(inputs), created_by: c.userId,
  }).select("*").single();
  fail(error);
  await logEvidence(c.db, c.ws, { kind: "video.project_created", actor: c.actor, summary: `Tạo video «${title}» (${t.label.vi}, ${input.aspect}, ${seconds} giây)` }).catch(() => undefined);
  return toView(c, data as ProjectRow, null);
};

export type ProjectPatch = {
  readonly title?: string; readonly goal?: Goal; readonly aspect?: Aspect; readonly targetSeconds?: number;
  readonly inputs?: ProjectInputs; readonly script?: ReadonlyArray<ScriptScene>;
};

/** Edit a draft. A video that is rendering, approved or published is not edited in place: duplicate it (or re-render from the editor, which makes the next version). */
export const updateProject = async (c: VideoCtx, id: string, p: ProjectPatch): Promise<ProjectView> => {
  const cur = await loadRow(c, id);
  if (cur.status === "scripting" || cur.status === "rendering") throw new Error("Video đang được soạn hoặc dựng, chờ xong rồi sửa nhé.");
  const patch: Record<string, unknown> = {};
  if (p.title !== undefined) patch.title = p.title.trim().slice(0, 120) || cur.title;
  if (p.goal !== undefined && isGoal(p.goal)) patch.goal = p.goal;
  if (p.aspect !== undefined && (ASPECTS as ReadonlyArray<string>).includes(p.aspect)) patch.aspect = p.aspect;
  if (p.targetSeconds !== undefined) patch.target_seconds = Math.min(90, Math.max(10, Math.round(p.targetSeconds)));
  if (p.inputs !== undefined) patch.inputs = writeInputs({ ...p.inputs, sourceIds: p.inputs.sourceIds.slice(0, 12), media: p.inputs.media.filter((m) => m.toLowerCase().startsWith(`${c.ws.toLowerCase()}/`)) });
  if (p.script !== undefined) {
    const scenes = readScript(p.script).map((s) => ({ ...s, media: s.media && s.media.toLowerCase().startsWith(`${c.ws.toLowerCase()}/`) ? s.media : null }));
    patch.script = scenes;
  }
  // Editing a ready/approved video makes it a draft again: what was approved is no longer what is on screen.
  if (p.script !== undefined && ["ready", "approved", "published"].includes(cur.status)) patch.status = "draft";
  const row = await patchRow(c, id, patch);
  if (!row) throw new Error("Không tìm thấy video này.");
  return getProject(c, id);
};

export const duplicateProject = async (c: VideoCtx, id: string): Promise<ProjectView> => {
  const src = await loadRow(c, id);
  const { data, error } = await c.db.from("video_projects").insert({
    workspace_id: c.ws, title: `${src.title} (bản sao)`.slice(0, 120), goal: src.goal, aspect: src.aspect, target_seconds: src.target_seconds, inputs: src.inputs, script: src.script,
    source_project_id: src.id, created_by: c.userId,
  }).select("*").single();
  fail(error);
  await logEvidence(c.db, c.ws, { kind: "video.project_duplicated", actor: c.actor, summary: `Nhân bản video «${src.title}»` }).catch(() => undefined);
  return toView(c, data as ProjectRow, null);
};

export const archiveProject = async (c: VideoCtx, id: string, archived: boolean): Promise<void> => {
  const cur = await loadRow(c, id);
  if (cur.status === "scripting" || cur.status === "rendering") throw new Error("Video đang được soạn hoặc dựng.");
  await patchRow(c, id, { status: archived ? "archived" : cur.render_id ? "ready" : "draft" });
};

/* ------------------------------------------------------------------ the script (OpenClaw) */

const MAX_SOURCE_CHARS_EACH = 1600;
const MAX_SOURCE_CHARS_TOTAL = 5200;

/** How many scenes and how long each voiceover runs for a target length (about 14 characters a second, as the spec's length estimate assumes). */
export const scenePlan = (seconds: number): { readonly scenes: number; readonly voiceChars: number } => {
  const scenes = Math.min(8, Math.max(3, Math.round(seconds / 6)));
  return { scenes, voiceChars: Math.max(40, Math.round(((seconds / scenes) - 0.8) * 14)) };
};

const sourcesText = async (c: Pick<VideoCtx, "db" | "ws">, ids: ReadonlyArray<string>): Promise<string> => {
  if (!ids.length) return "";
  const { data } = await c.db.from("knowledge_sources").select("id, title, topic, content").eq("workspace_id", c.ws).eq("visibility", "public").in("id", [...ids]);
  let budget = MAX_SOURCE_CHARS_TOTAL;
  const parts: Array<string> = [];
  for (const r of (data ?? []) as Array<{ title: string; topic: string | null; content: string }>) {
    const text = r.content.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, Math.min(MAX_SOURCE_CHARS_EACH, budget));
    if (!text) continue;
    budget -= text.length;
    parts.push(`### ${r.topic ? `${r.topic} / ` : ""}${r.title}\n${text}`);
    if (budget <= 0) break;
  }
  return parts.join("\n\n");
};

export const SCRIPT_SYSTEM = [
  "You write the script of a SHORT MARKETING VIDEO for a small business in Vietnam, scene by scene. Write in simple, natural Vietnamese in the shop's own voice (see the shop context). Use the shop's pronouns (xưng hô) when the context gives them.",
  "Rules: use ONLY facts that appear in the INFORMATION and the shop context. Never invent a price, discount, deadline, address, phone number, result, ranking or customer quote. If a fact is missing, speak in general terms or leave it out. No comparison with competitors, no guaranteed results, no medical or financial promises. Respect every 'claims to avoid' limit in the context.",
  "Structure: scene 1 is the HOOK (stops the scroll in 2 seconds), the middle scenes are the BODY (one idea each), the last scene is the CTA (one clear next step). Short sentences. No hashtags, no emoji.",
  "Output: ONLY one JSON object, nothing before or after it: {\"title\": \"short working title\", \"scenes\": [{\"role\": \"hook|body|cta\", \"caption\": \"words shown on screen, at most 60 characters\", \"voiceover\": \"what the voice says\", \"visual\": \"what the owner should show in this scene, in Vietnamese, one short phrase\"}]}.",
].join("\n");

const buildMessages = async (c: VideoCtx, p: ProjectRow, brand: Brand): Promise<Array<GenMessage>> => {
  const goal: Goal = isGoal(p.goal) ? p.goal : "custom";
  const t = templateOf(goal);
  const inputs = readInputs(p.inputs);
  const plan = scenePlan(p.target_seconds);
  const roles = Array.from({ length: plan.scenes }, (_, i) => (i === 0 ? "hook" : i === plan.scenes - 1 ? "cta" : "body"));
  const bodyBriefs = t.scenes.filter((s) => s.role === "body").map((s) => s.brief);
  let b = 0;
  const outline = roles.map((role, i) => {
    const brief = role === "hook" ? t.scenes.find((s) => s.role === "hook")?.brief : role === "cta" ? t.scenes.find((s) => s.role === "cta")?.brief : bodyBriefs[b++ % Math.max(1, bodyBriefs.length)];
    return `${i + 1}. ${role.toUpperCase()}: ${brief ?? ""}`;
  }).join("\n");
  const info = await sourcesText(c, inputs.sourceIds);
  const query = [t.label.vi, inputs.notes, info.slice(0, 300)].filter(Boolean).join(" ");
  // The shop's approved context (tone, claims to avoid) and the best public passages; customer audience = public knowledge only.
  const ctx = await buildAgentContext({ workspaceId: c.ws, module: "video", query, audience: "customer", db: c.db, limit: 6 });
  const media = inputs.media.length ? `The owner uploaded ${inputs.media.length} photo/clip file(s); suggest in "visual" what each scene should show (the owner picks the file).` : "The owner has no photos yet; the scenes will be colour cards with big words, so make each caption a strong short headline.";
  const user = [
    `SHOP: ${brand.shopName || "(name not set)"}`,
    `GOAL: ${t.label.vi}. ${t.hint.vi}`,
    `FORMAT: ${p.aspect}, about ${p.target_seconds} seconds in total.`,
    `SCENES: exactly ${plan.scenes}. Each voiceover about ${plan.voiceChars} characters (never above ${plan.voiceChars + 30}).`,
    `OUTLINE:\n${outline}`,
    inputs.notes ? `THE OWNER WANTS TO STRESS: ${inputs.notes}` : "",
    info ? `INFORMATION (the only facts you may use besides the shop context):\n${info}` : "INFORMATION: none was selected; rely on the shop context and keep claims general.",
    media,
    "Return the JSON object now.",
  ].filter(Boolean).join("\n\n");
  return [{ role: "system", content: `${SCRIPT_SYSTEM}\n\n${ctx.system}` }, { role: "user", content: user }];
};

export type ScriptTiming = { readonly totalMs: number; readonly attempts: number; readonly openclaw: Record<string, number> };
export type ScriptOutcome = { readonly ok: true; readonly project: ProjectView; readonly timing: ScriptTiming } | { readonly ok: false; readonly error: string };

/** Mark the project as being scripted. False when it already is (a second click must not start a second generation). */
export const beginScripting = async (c: VideoCtx, id: string): Promise<boolean> => {
  const cur = await loadRow(c, id);
  if (cur.status === "rendering") throw new Error("Video đang được dựng, chờ xong rồi soạn lại nhé.");
  const stale = cur.status === "scripting" && Date.now() - Date.parse(String((cur.script_meta ?? {}).started_at ?? cur.updated_at)) > SCRIPT_STALE_MS;
  if (cur.status === "scripting" && !stale) return false;
  const row = await patchRow(c, id, { status: "scripting", last_error: null, script_meta: { started_at: now() } });
  return row !== null;
};

/**
 * The long part: one OpenClaw call (a second only when the first answer was not valid JSON), then the scenes are saved on the project.
 * Never throws: a failure leaves the project a draft with `last_error` (plain Vietnamese) and the old script untouched.
 */
export const runScripting = async (c: VideoCtx, id: string, opts: { readonly notify?: boolean } = {}): Promise<ScriptOutcome> => {
  const t0 = Date.now();
  const failWith = async (error: string): Promise<ScriptOutcome> => {
    await patchRow(c, id, { status: "draft", last_error: error }, ["scripting"]).catch(() => null);
    return { ok: false, error };
  };
  try {
    const p = await loadRow(c, id);
    const brand = await loadBrand(c);
    const messages = await buildMessages(c, p, brand);
    let attempts = 0;
    let parsed: ReturnType<typeof parseScriptOutput> = { ok: false, error: "no answer" };
    let last: { generationId: string; timings: Record<string, number>; usage: unknown } | null = null;
    while (attempts < 2 && !parsed.ok) {
      attempts += 1;
      const r = await generateWithOpenClaw({
        workspaceId: c.ws, purpose: "video_script", module: "video", kind: "engine", responseFormat: "json", timeoutMs: 110_000,
        messages: attempts === 1 ? messages : [...messages, { role: "user", content: "Your previous answer was not one valid JSON object. Return ONLY the JSON object described above." }],
      });
      if (!r.ok) return failWith(r.reason === "quota" ? r.message : r.reason === "engine_offline" ? "NIVO chưa sẵn sàng soạn kịch bản (máy dựng đang tắt). Thử lại sau ít phút." : "NIVO đang bận, bạn thử soạn lại sau ít phút.");
      last = { generationId: r.generationId, timings: r.timings, usage: r.usage };
      parsed = parseScriptOutput(r.output);
    }
    if (!parsed.ok) return failWith("NIVO soạn chưa đúng khuôn. Bạn bấm soạn lại nhé.");

    // The owner's uploaded media go to the scenes in order (the owner re-picks per scene); a scene never gets a file twice before every file is used.
    const media = readInputs(p.inputs).media;
    const scenes = parsed.scenes.map((s, i) => ({ ...s, media: media.length ? media[i % media.length] : null }));
    const totalMs = Date.now() - t0;
    const autoTitle = /^(Giới thiệu dịch vụ|Ưu đãi|Phản hồi khách|Hậu trường|Tuyển dụng|Tuỳ chỉnh)( ·|$)/.test(p.title) || p.title.startsWith("Soạn tự động");
    const row = await patchRow(c, id, {
      status: "draft", script: scenes, last_error: null, script_ms: totalMs, ...(autoTitle && parsed.title ? { title: parsed.title } : {}),
      script_meta: { generation_id: last?.generationId, timings: last?.timings ?? {}, usage: last?.usage ?? null, attempts, finished_at: now() },
    }, ["scripting"]);
    if (!row) return { ok: false, error: "Video đã được đổi trong lúc soạn." };
    await logEvidence(c.db, c.ws, {
      kind: "video.script_generated", actor: "OpenClaw", summary: `Soạn kịch bản «${row.title}»: ${scenes.length} cảnh, ${(totalMs / 1000).toFixed(1)} giây`,
      evidence: scenes.map((s, i) => `${i + 1}. ${s.caption}`).join("\n"),
    }).catch(() => undefined);
    const view = await getProject(c, id);
    if (opts.notify) await notifyOwner(c, `Mình đã soạn nháp video «${row.title}» (${scenes.length} cảnh, khoảng ${estimateScriptSeconds(scenes)} giây). Mở Tạo video để xem, sửa và dựng.`).catch(() => undefined);
    return { ok: true, project: view, timing: { totalMs, attempts, openclaw: last?.timings ?? {} } };
  } catch (e) {
    console.error("video script failed:", e instanceof Error ? e.message : e);
    return failWith("Không soạn được kịch bản. Bạn thử lại sau nhé.");
  }
};

/* ------------------------------------------------------------------ render */

const renderError = (r: Exclude<Awaited<ReturnType<typeof enqueueRender>>, { ok: true }>): string => {
  if (r.error === "invalid_spec") return `Kịch bản chưa dựng được: ${r.errors.slice(0, 2).join("; ")}`;
  if (r.error === "too_many_open_renders") return "Đang có nhiều video đang dựng, chờ một video xong rồi dựng tiếp nhé.";
  if (r.error === "engine_not_configured") return "Máy dựng video chưa được cấu hình.";
  return "Chưa đưa được video vào hàng dựng, bạn thử lại sau nhé.";
};

/** The spec the project would render now (validated). Used by the storyboard (length estimate) and by renderProject. */
export const specFor = async (c: VideoCtx, p: ProjectRow): Promise<{ readonly ok: true; readonly spec: unknown } | { readonly ok: false; readonly errors: ReadonlyArray<string> }> => {
  const brand = await loadBrand(c);
  const goal: Goal = isGoal(p.goal) ? p.goal : "custom";
  const scenes = readScript(p.script);
  if (scenes.length === 0) return { ok: false, errors: ["Chưa có cảnh nào."] };
  const raw = buildVideoSpec({ scenes, aspect: (ASPECTS as ReadonlyArray<string>).includes(p.aspect) ? (p.aspect as Aspect) : "9:16", brand, goal, shopFallback: "Cửa hàng" });
  const checked = validateVideoSpec(raw, { workspaceId: c.ws });
  return checked.ok ? { ok: true, spec: checked.spec } : { ok: false, errors: checked.errors };
};

/** "Dựng video": validate, put the render on the queue, remember it (and snapshot this version of the script). */
export const renderProject = async (c: VideoCtx, id: string): Promise<ProjectView> => {
  const p = await loadRow(c, id);
  if (p.status === "scripting") throw new Error("Kịch bản đang được soạn, chờ xong rồi dựng nhé.");
  if (p.status === "rendering") throw new Error("Video đang được dựng.");
  const built = await specFor(c, p);
  if (!built.ok) throw new Error(`Kịch bản chưa dựng được: ${built.errors.slice(0, 2).join("; ")}`);
  const r = await enqueueRender({ workspaceId: c.ws, spec: built.spec, createdBy: c.userId });
  if (!r.ok) throw new Error(renderError(r));
  fail((await c.db.from("video_project_versions").insert({ project_id: id, workspace_id: c.ws, version: p.version, script: p.script, spec: built.spec, render_id: r.renderId, created_by: c.userId })).error);
  const row = await patchRow(c, id, {
    status: "rendering", render_id: r.renderId, render_ids: [...(p.render_ids ?? []), r.renderId], current_spec: built.spec, version: p.version + 1, last_error: null,
    approved_at: null, approved_by_name: null, published_at: null,
  });
  if (!row) throw new Error("Không tìm thấy video này.");
  await logEvidence(c.db, c.ws, { kind: "video.render_queued", actor: c.actor, summary: `Đưa video «${p.title}» vào hàng dựng (bản ${p.version})`, evidence: r.renderId }).catch(() => undefined);
  return getProject(c, id);
};

/* ------------------------------------------------------------------ approval (what the performer does) and sharing */

/** After the owner approved through the gate: the video is approved (ready to download and share). NIVO never posts it anywhere by itself. */
export const markApproved = async (c: VideoCtx, id: string, by: string): Promise<ProjectRow> => {
  const p = await loadRow(c, id);
  if (!["ready", "approved", "published"].includes(p.status)) throw new Error("Video chưa dựng xong nên chưa duyệt được.");
  if (!p.render_id) throw new Error("Video chưa có bản dựng.");
  const render = await getRender(c.db, c.ws, p.render_id);
  if (!render || render.status !== "done") throw new Error("Bản dựng chưa xong.");
  if (p.status !== "ready") return p;
  const row = await patchRow(c, id, { status: "approved", approved_at: now(), approved_by_name: by }, ["ready"]);
  return row ?? p;
};

/** "Tôi đã đăng xong": the owner posted the downloaded file themselves. The only way a video becomes `published`. */
export const markPublished = async (c: VideoCtx, id: string): Promise<ProjectView> => {
  const p = await loadRow(c, id);
  if (p.status !== "approved") throw new Error("Chỉ video đã duyệt mới đánh dấu là đã đăng.");
  await patchRow(c, id, { status: "published", published_at: now() }, ["approved"]);
  await logEvidence(c.db, c.ws, { kind: "video.published_by_owner", actor: c.actor, summary: `${c.actor} xác nhận đã tự đăng video «${p.title}»` }).catch(() => undefined);
  return getProject(c, id);
};

export const projectRow = loadRow;

/** A line in Office from NIVO, and the owner's own Telegram chat when a Telegram connection records it. Returns what actually happened. */
export const notifyOwner = async (c: Pick<VideoCtx, "db" | "ws">, text: string): Promise<{ readonly office: boolean; readonly telegram: boolean }> => {
  const ins = await c.db.from("messages").insert({ workspace_id: c.ws, author_kind: "system", author_name: "NIVO", agent_id: null, body: text });
  let telegram = false;
  const { data } = await c.db.from("connections").select("id, public_meta").eq("workspace_id", c.ws).eq("provider", "telegram").eq("status", "connected");
  for (const conn of (data ?? []) as Array<{ id: string; public_meta: Connection["meta"] | null }>) {
    const chatId = conn.public_meta?.owner_chat_id;
    if (!chatId) continue;
    const token = await resolveBotToken(c.ws, conn.id);
    if (!token) continue;
    try {
      await telegramSend(token, chatId, text);
      telegram = true;
      break;
    } catch (e) {
      console.error("video share telegram failed:", e instanceof Error ? e.message : e);
    }
  }
  return { office: !ins.error, telegram };
};

/** Share an approved video with the owner through Office (+ Telegram when connected): a link that works for 3 days. */
export const shareToOwner = async (c: VideoCtx, id: string): Promise<{ readonly office: boolean; readonly telegram: boolean }> => {
  const p = await loadRow(c, id);
  if (p.status !== "approved" && p.status !== "published") throw new Error("Bạn duyệt video rồi mới gửi được nhé.");
  const render = p.render_id ? await getRender(c.db, c.ws, p.render_id) : null;
  if (!render?.output_path) throw new Error("Video chưa có bản dựng.");
  const urls = await signedRenderUrls(c.db, render, { expiresInSec: 3 * 24 * 3600, downloadAs: "video.mp4" });
  if (!urls.videoUrl) throw new Error("Không tạo được liên kết tải.");
  const res = await notifyOwner(c, `Video «${p.title}» đã duyệt. Tải về (liên kết dùng được trong 3 ngày): ${urls.videoUrl}`);
  await logEvidence(c.db, c.ws, { kind: "video.shared", actor: c.actor, summary: `Gửi video «${p.title}» cho chủ qua ${res.telegram ? "Văn phòng và Telegram" : "Văn phòng"}` }).catch(() => undefined);
  return res;
};
