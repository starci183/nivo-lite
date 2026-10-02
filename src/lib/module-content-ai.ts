import "server-only";
import { logDecision, logEvidence } from "./core";
import { generateWithOpenClaw } from "./openclaw-generate";
import { claimWarnings } from "./module-content-claims";
import {
  channelRule, cleanHashtags, eventsForMonth, GUARDRAILS, isContentChannel, monthKey, slotsForMonth, vnParts, vnToIso, pad2,
  type ContentChannel, type ContentItem, type ContentSettings, type MediaRef, type Pillar, type Variants,
} from "./module-content-shared";
import { addEvidence, getItem, listCadence, listItems, listPillars, loadSettings, toItem, type Db } from "./module-content-store";

/**
 * AI side of the content module. OpenClaw (generateWithOpenClaw) is the only text AI. It writes ideas and drafts only: nothing here posts anywhere,
 * and publishing goes through the `publish_post` gate (module-content-publish.ts).
 */

const KNOWLEDGE_BUDGET = 7000;
const PER_SOURCE_BUDGET = 1600;

export type BrandContext = {
  shop: string;
  /** Real facts about the business (offers, products, policies) the posts may use. */
  knowledge: string;
  /** Titles of the knowledge sources, so a plan can say what it was grounded in. */
  sources: ReadonlyArray<string>;
  voice: string;
  avoid: string;
  audience: string;
  channelsNote: string;
  cta: string;
  brandHashtags: ReadonlyArray<string>;
};

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n).trimEnd()}...` : s);

/** Everything the posts are grounded in: the business knowledge, the tone gate of the applied context, the owner's brand settings and limits. */
export const loadBrandContext = async (db: Db, ws: string, settings?: ContentSettings): Promise<BrandContext> => {
  const s = settings ?? (await loadSettings(db, ws));
  const [shopRes, authRes, instRes, srcRes] = await Promise.all([
    db.from("workspaces").select("name").eq("id", ws).maybeSingle(),
    db.from("authority").select("brand_voice, reply_style, limits_note, policies").eq("workspace_id", ws).maybeSingle(),
    db.from("module_installations").select("active_context_version_id").eq("workspace_id", ws).eq("module_key", "content").maybeSingle(),
    db.from("knowledge_sources").select("title, topic, kind, content, module").eq("workspace_id", ws).eq("status", "ready").order("created_at"),
  ]);
  const auth = (authRes.data ?? {}) as { brand_voice?: string; reply_style?: string; limits_note?: string; policies?: string };

  let ctxSummary = "";
  let gates: Record<string, { evidence?: string }> = {};
  let facts: Array<{ text: string }> = [];
  const versionId = (instRes.data as { active_context_version_id?: string | null } | null)?.active_context_version_id;
  if (versionId) {
    const v = await db.from("module_context_versions").select("snapshot").eq("id", versionId).maybeSingle();
    const snap = (v.data as { snapshot?: { summary?: string; facts?: Array<{ text: string }>; gates?: Record<string, { evidence?: string }> } } | null)?.snapshot;
    ctxSummary = snap?.summary ?? "";
    facts = snap?.facts ?? [];
    gates = snap?.gates ?? {};
  }

  const rows = ((srcRes.data ?? []) as Array<{ title: string; topic: string | null; kind: string; content: string; module: string | null }>).filter((r) => !r.module || r.module === "content");
  let used = 0;
  const parts: Array<string> = [];
  for (const r of rows) {
    const block = `### ${r.title}${r.topic ? ` (${r.topic})` : ""}\n${clip(r.content.trim(), PER_SOURCE_BUDGET)}`;
    if (used + block.length > KNOWLEDGE_BUDGET) break;
    parts.push(block);
    used += block.length;
  }
  const factLines = facts.map((f) => `- ${f.text}`).join("\n");
  const knowledge = [ctxSummary ? `Tóm tắt doanh nghiệp: ${ctxSummary}` : "", factLines ? `Điều đã xác nhận khi thiết lập:\n${factLines}` : "", ...parts].filter(Boolean).join("\n\n");

  const voice = [gates.tone?.evidence, auth.brand_voice, auth.reply_style, s.brand_voice].map((x) => (x ?? "").trim()).filter(Boolean).join(" | ");
  const avoid = [gates.claims_limits?.evidence, auth.limits_note, s.avoid].map((x) => (x ?? "").trim()).filter(Boolean).join(" | ");
  return {
    shop: ((shopRes.data as { name?: string } | null)?.name ?? "").trim(), knowledge, sources: rows.map((r) => r.title), voice, avoid,
    audience: (gates.audience?.evidence ?? "").trim(), channelsNote: (gates.channels?.evidence ?? "").trim(), cta: s.cta.trim(), brandHashtags: cleanHashtags(s.hashtags),
  };
};

const brandBlock = (b: BrandContext): string =>
  [
    `Doanh nghiệp: ${b.shop || "(chưa có tên)"}`,
    b.audience ? `Khách hàng mục tiêu: ${b.audience}` : "",
    b.voice ? `Giọng thương hiệu (bắt buộc theo): ${b.voice}` : "Giọng thương hiệu: gần gũi, thật, có ích, xưng hô lịch sự.",
    b.avoid ? `Điều KHÔNG được nói: ${b.avoid}` : "",
    b.cta ? `Lời kêu gọi quen thuộc: ${b.cta}` : "",
    "",
    "THÔNG TIN THẬT CỦA DOANH NGHIỆP (chỉ được dùng những gì có ở đây):",
    b.knowledge || "(chưa có tri thức: chỉ viết nội dung chung, không nêu giá, ưu đãi, địa chỉ, số điện thoại)",
  ].filter((l) => l !== "").join("\n");

const guardrailBlock = (): string => `QUY TẮC BẤT BIẾN:\n${GUARDRAILS.map((g) => `- ${g}`).join("\n")}\n- Viết tiếng Việt đơn giản, ngắn gọn, không văn hoa, không dùng từ chuyên môn khó hiểu.`;

/* ------------------------------------------------------------------ JSON */

/** Pull the first JSON object out of a model answer (it may arrive in a code fence or with a sentence around it). */
export const parseJsonObject = (text: string): Record<string, unknown> | null => {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const tryParse = (s: string): Record<string, unknown> | null => {
    try { const v = JSON.parse(s) as unknown; return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null; } catch { return null; }
  };
  const direct = tryParse(t);
  if (direct) return direct;
  const a = t.indexOf("{"); const z = t.lastIndexOf("}");
  return a >= 0 && z > a ? tryParse(t.slice(a, z + 1)) : null;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/* ------------------------------------------------------------------ the month plan */

export type PlanOptions = { y: number; m: number; actor: string; /** also plan the days that already passed this month */ includePast?: boolean; now?: Date };
export type PlanResult =
  | { ok: true; planId: string; ideas: number; ms: number; skippedPast: number; usedHolidays: ReadonlyArray<string>; generationId: string; raw: Record<string, unknown> }
  | { ok: false; error: string; ms: number };

/** How many posts each pillar should get out of `total`, by weight (largest remainder). */
export const pillarQuota = (pillars: ReadonlyArray<Pillar>, total: number): Array<{ pillar: Pillar; count: number }> => {
  const active = pillars.filter((p) => p.active && p.weight > 0);
  const sum = active.reduce((s, p) => s + p.weight, 0);
  if (!active.length || total <= 0) return [];
  const raw = active.map((p) => ({ pillar: p, exact: (p.weight / sum) * total }));
  const rows = raw.map((r) => ({ pillar: r.pillar, count: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let left = total - rows.reduce((s, r) => s + r.count, 0);
  for (const r of [...rows].sort((a, b) => b.rem - a.rem)) { if (left <= 0) break; r.count += 1; left -= 1; }
  return rows.map(({ pillar, count }) => ({ pillar, count }));
};

type PlanSlot = { n: number; at: string; channels: Array<ContentChannel> };

const groupSlots = (slots: ReadonlyArray<{ channel: ContentChannel; at: string }>): Array<PlanSlot> => {
  const by = new Map<string, Array<ContentChannel>>();
  for (const s of slots) by.set(s.at, [...(by.get(s.at) ?? []), s.channel]);
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([at, channels], i) => ({ n: i + 1, at, channels }));
};

const localLabel = (iso: string): string => {
  const p = vnParts(new Date(iso));
  const wd = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][p.dow];
  return `${wd} ${pad2(p.day)}/${pad2(p.m)}/${p.y} ${pad2(p.h)}:${pad2(p.min)}`;
};

/** Offers worth planning around: knowledge sources that talk about prices, promotions or events. */
const offerLines = (b: BrandContext): string => {
  const hits = b.knowledge.split("\n").filter((l) => /ưu đãi|khuyến mãi|giảm|combo|gói|tặng|miễn phí|sự kiện|khai trương/i.test(l)).slice(0, 12);
  return hits.length ? hits.join("\n") : "(không thấy ưu đãi nào trong thông tin: KHÔNG tạo ý tưởng nói về giảm giá)";
};

/**
 * "Lên kế hoạch tháng": one OpenClaw call that returns one idea per posting slot of the cadence, balanced across the pillars, anchored on the real
 * holidays of the month and the business facts. The owner then accepts or edits each idea. Ideas are inserted as status `idea`.
 */
export const planMonth = async (db: Db, ws: string, o: PlanOptions): Promise<PlanResult> => {
  const t0 = Date.now();
  const now = o.now ?? new Date();
  const fail = (error: string): PlanResult => ({ ok: false, error, ms: Date.now() - t0 });
  const [pillars, cadence, settings] = await Promise.all([listPillars(db, ws), listCadence(db, ws), loadSettings(db, ws)]);
  const active = pillars.filter((p) => p.active && p.weight > 0);
  if (!active.length) return fail("Chưa có chủ đề nội dung. Thêm ít nhất một chủ đề trước khi lên kế hoạch.");
  if (!cadence.some((c) => c.posts_per_week > 0)) return fail("Chưa có tần suất đăng. Chọn kênh và số bài mỗi tuần trước.");

  const allSlots = slotsForMonth(o.y, o.m, cadence, o.includePast ? new Date(0) : now);
  const skippedPast = o.includePast ? 0 : slotsForMonth(o.y, o.m, cadence).length - allSlots.length;
  const slots = groupSlots(allSlots);
  if (!slots.length) return fail("Tháng này không còn ngày nào để đăng theo tần suất đã chọn.");

  const brand = await loadBrandContext(db, ws, settings);
  const holidays = eventsForMonth(o.y, o.m);
  const quota = pillarQuota(active, slots.length);
  const existing = await listItems(db, ws, { from: vnToIso(o.y, o.m, 1), to: vnToIso(o.m === 12 ? o.y + 1 : o.y, o.m === 12 ? 1 : o.m + 1, 1) });
  const kept = existing.filter((i) => !(i.status === "idea" && i.source === "plan"));

  const system = [
    "Bạn là người lên lịch nội dung mạng xã hội cho một doanh nghiệp nhỏ ở Việt Nam. Bạn chỉ đề xuất ý tưởng bài đăng; chủ doanh nghiệp sẽ duyệt.",
    brandBlock(brand),
    guardrailBlock(),
    `Trả về DUY NHẤT một đối tượng JSON dạng: {"ideas":[{"slot":<số thứ tự ô đăng>,"pillar":"<đúng tên một chủ đề>","title":"<tiêu đề ngắn dưới 80 ký tự>","brief":"<2-3 câu: góc nội dung, ý chính, thông tin thật cần dùng, lời kêu gọi>","holiday":"<khóa dịp lễ hoặc null>"}]}. Mỗi ô đăng đúng một ý tưởng. Không thêm chữ nào ngoài JSON.`,
  ].join("\n\n");

  const user = [
    `Tháng cần lên kế hoạch: ${pad2(o.m)}/${o.y}.`,
    `CÁC Ô ĐĂNG (giờ Việt Nam), mỗi ô một ý tưởng:\n${slots.map((s) => `${s.n}. ${localLabel(s.at)} - kênh: ${s.channels.map((c) => channelRule(c).label).join(", ")}`).join("\n")}`,
    `SỐ BÀI MỖI CHỦ ĐỀ (cân bằng theo trọng số, cố gắng đúng số này):\n${quota.map((q) => `- ${q.pillar.name}: ${q.count} bài${q.pillar.description ? ` (${q.pillar.description})` : ""}`).join("\n")}`,
    holidays.length
      ? `DỊP LỄ VÀ NGÀY ĐẶC BIỆT gần tháng này (đưa vào đúng ô gần ngày đó, chuẩn bị trước vài ngày; điền khóa vào "holiday"):\n${holidays.map((h) => `- [${h.key}] ${h.name}, ngày ${h.date.split("-").reverse().join("/")}. Gợi ý: ${h.angle}`).join("\n")}`
      : "Tháng này không có dịp lễ lớn.",
    `ƯU ĐÃI VÀ SẢN PHẨM THẬT có thể nhắc tới:\n${offerLines(brand)}`,
    kept.length ? `ĐÃ CÓ BÀI TRONG THÁNG (đừng lặp ý):\n${kept.slice(0, 20).map((i) => `- ${i.title}`).join("\n")}` : "",
    "Chủ đề của một ý tưởng phải nằm trong danh sách chủ đề ở trên. Không hai ô liền kề cùng chủ đề nếu tránh được. Không bịa ưu đãi hay con số.",
  ].filter(Boolean).join("\n\n");

  const r = await generateWithOpenClaw({
    workspaceId: ws, purpose: "content_plan", module: "content", responseFormat: "json", timeoutMs: 120_000,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  if (!r.ok) return fail(r.message);
  const parsed = parseJsonObject(r.output);
  const list = Array.isArray(parsed?.ideas) ? (parsed.ideas as Array<unknown>) : null;
  if (!parsed || !list) return fail("OpenClaw trả về kết quả không đọc được. Thử lại.");

  const byName = new Map(active.map((p) => [p.name.toLowerCase(), p]));
  const holidayKeys = new Set(holidays.map((h) => h.key));
  const used = new Set<number>();
  const rows: Array<Record<string, unknown>> = [];
  for (const raw of list) {
    const it = raw as Record<string, unknown>;
    const n = typeof it.slot === "number" ? it.slot : Number(it.slot);
    const slot = slots.find((s) => s.n === n);
    const title = str(it.title).slice(0, 200);
    if (!slot || used.has(n) || !title) continue;
    used.add(n);
    const pillar = byName.get(str(it.pillar).toLowerCase()) ?? null;
    const hk = str(it.holiday);
    rows.push({
      workspace_id: ws, title, brief: str(it.brief), pillar_id: pillar?.id ?? null, channels: slot.channels, scheduled_at: slot.at, status: "idea", source: "plan",
      holiday_key: holidayKeys.has(hk) ? hk : null, created_by: o.actor,
      evidence: [{ at: new Date().toISOString(), kind: "planned", by: "NIVO", text: `Ý tưởng từ kế hoạch tháng ${pad2(o.m)}/${o.y} (OpenClaw).` }],
    });
  }
  if (!rows.length) return fail("OpenClaw không đưa ra ý tưởng nào dùng được. Thử lại.");

  const ms = Date.now() - t0;
  const plan = await db.from("content_plans").insert({
    workspace_id: ws, month: `${o.y}-${pad2(o.m)}-01`, status: "done", idea_count: rows.length, ai_ms: ms,
    meta: { generation_id: r.generationId, usage: r.usage, timings: r.timings, slots: slots.length, quota: quota.map((q) => ({ pillar: q.pillar.name, count: q.count })), holidays: holidays.map((h) => h.key), sources: brand.sources },
    created_by: o.actor,
  }).select("id").single();
  if (plan.error || !plan.data) return fail(plan.error?.message ?? "Không lưu được kế hoạch.");
  const planId = (plan.data as { id: string }).id;

  // A new plan replaces the ideas of the previous plan of this month that nobody touched.
  const stale = existing.filter((i) => i.status === "idea" && i.source === "plan").map((i) => i.id);
  if (stale.length) await db.from("content_items").delete().in("id", stale).eq("workspace_id", ws);
  const ins = await db.from("content_items").insert(rows.map((x) => ({ ...x, plan_id: planId })));
  if (ins.error) return fail(ins.error.message);
  await logEvidence(db, ws, { kind: "content.planned", actor: o.actor, summary: `Lên kế hoạch tháng ${pad2(o.m)}/${o.y}: ${rows.length} ý tưởng`, evidence: `${Math.round(ms / 1000)} giây · ${monthKey(o.y, o.m)}` });
  return { ok: true, planId, ideas: rows.length, ms, skippedPast, usedHolidays: [...holidayKeys], generationId: r.generationId, raw: parsed };
};

/* ------------------------------------------------------------------ drafting */

/** Images in the workspace's media library the draft may suggest (the bucket the render lane and uploads share). */
export const listMediaLibrary = async (db: Db, ws: string, limit = 40): Promise<Array<MediaRef>> => {
  try {
    const { data } = await db.storage.from("media").list(ws, { limit, sortBy: { column: "created_at", order: "desc" } });
    return (data ?? []).filter((f) => f.name && !f.name.endsWith("/") && /\.(jpe?g|png|webp|mp4|mov|webm)$/i.test(f.name)).map((f) => ({
      kind: "media" as const, path: `${ws}/${f.name}`, name: f.name.replace(/^[0-9a-f-]{36}-/i, ""),
    }));
  } catch {
    return [];
  }
};

export type DraftResult = { ok: true; item: ContentItem; warnings: ReadonlyArray<string>; ms: number; generationId: string } | { ok: false; error: string; ms: number };

const ASSIST_NOTE = "Soạn bản nháp là việc nội bộ, chưa gửi ra ngoài; quyền draft_post do chủ cấp ở trang Quyền hạn.";

/** Is the owner's authority for `draft_post` switched off? (No rule at all = allowed: drafting never leaves the building.) */
const draftingBlocked = async (db: Db, ws: string): Promise<boolean> => {
  const { data } = await db.from("authority_rules").select("mode").eq("workspace_id", ws).eq("action", "draft_post").maybeSingle();
  return (data as { mode?: string } | null)?.mode === "never";
};

/**
 * Write the channel variants of one item with OpenClaw. Allowed from idea or draft only (a post waiting for approval, approved or published is
 * not rewritten under the owner's feet). The result is a draft (status `draft`) with warnings for outcome promises and unknown discount figures.
 */
export const draftItem = async (db: Db, ws: string, itemId: string, actor: string, opts: { channels?: ReadonlyArray<ContentChannel>; hint?: string } = {}): Promise<DraftResult> => {
  const t0 = Date.now();
  const fail = (error: string): DraftResult => ({ ok: false, error, ms: Date.now() - t0 });
  const item = await getItem(db, ws, itemId);
  if (!item) return fail("Không tìm thấy bài này.");
  if (item.status !== "idea" && item.status !== "draft") return fail("Bài đã gửi duyệt hoặc đã đăng, không soạn lại được. Chỉnh sửa trực tiếp hoặc đưa về bản nháp trước.");
  if (await draftingBlocked(db, ws)) return fail("Chủ đang tắt quyền soạn bài (Quyền hạn: Soạn bài đăng = không).");

  const channels = (opts.channels?.length ? opts.channels : item.channels).filter(isContentChannel);
  const [pillars, settings, recent] = await Promise.all([listPillars(db, ws), loadSettings(db, ws), db.from("content_items").select("title").eq("workspace_id", ws).neq("id", itemId).order("created_at", { ascending: false }).limit(8)]);
  const brand = await loadBrandContext(db, ws, settings);
  const library = await listMediaLibrary(db, ws);
  const pillar = pillars.find((p) => p.id === item.pillar_id) ?? null;
  const when = vnParts(item.scheduled_at ? new Date(item.scheduled_at) : new Date());
  const holiday = item.holiday_key ? eventsForMonth(when.y, when.m).find((h) => h.key === item.holiday_key) ?? null : null;

  const shape = channels.map((c) => `"${c}":{"text":"...","hashtags":["#..."],"note":"..."}`).join(",");
  const system = [
    "Bạn là người viết bài mạng xã hội cho một doanh nghiệp nhỏ ở Việt Nam. Bạn viết bản nháp; chủ doanh nghiệp sẽ đọc, sửa và duyệt trước khi đăng.",
    brandBlock(brand),
    guardrailBlock(),
    `QUY TẮC TỪNG KÊNH:\n${channels.map((c) => { const r = channelRule(c); return `- ${r.label} (tối đa ${r.max_chars} ký tự): ${r.rules}`; }).join("\n")}`,
    `Trả về DUY NHẤT một đối tượng JSON: {"title":"<tiêu đề ngắn>","pillar":"<đúng tên một chủ đề hoặc null>","variants":{${shape}},"hashtags":["#chung"],"media":[<số thứ tự ảnh gợi ý hoặc để trống>]}. "text" là nội dung đăng sẵn, giữ xuống dòng bằng \\n. "note" là ghi chú ngắn cho chủ (ví dụ gợi ý quay video), có thể để trống. Không thêm chữ nào ngoài JSON.`,
  ].join("\n\n");

  const user = [
    `Ý tưởng: ${item.title}`,
    item.brief ? `Gợi ý nội dung: ${item.brief}` : "",
    pillar ? `Chủ đề: ${pillar.name}${pillar.description ? ` (${pillar.description})` : ""}` : `Các chủ đề có thể chọn: ${pillars.filter((p) => p.active).map((p) => p.name).join("; ") || "(chưa có)"}`,
    item.scheduled_at ? `Dự kiến đăng: ${localLabel(item.scheduled_at)}` : "",
    holiday ? `Dịp lễ: ${holiday.name} (${holiday.date.split("-").reverse().join("/")}). Gợi ý: ${holiday.angle}` : "",
    opts.hint ? `Yêu cầu thêm của chủ: ${opts.hint}` : "",
    (recent.data ?? []).length ? `Các bài gần đây (đừng lặp ý):\n${(recent.data as Array<{ title: string }>).map((r) => `- ${r.title}`).join("\n")}` : "",
    library.length ? `ẢNH TRONG THƯ VIỆN (chọn tối đa 2 cái hợp nội dung, ghi số thứ tự vào "media"):\n${library.map((m, i) => `${i + 1}. ${m.name}`).join("\n")}` : "Thư viện chưa có ảnh: để \"media\" là [].",
  ].filter(Boolean).join("\n\n");

  const r = await generateWithOpenClaw({
    workspaceId: ws, purpose: "content_draft", module: "content", responseFormat: "json", timeoutMs: 90_000,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  if (!r.ok) return fail(r.message);
  const parsed = parseJsonObject(r.output);
  const vs = parsed?.variants && typeof parsed.variants === "object" ? (parsed.variants as Record<string, unknown>) : null;
  if (!parsed || !vs) return fail("OpenClaw trả về kết quả không đọc được. Thử lại.");

  const variants: Variants = { ...item.variants };
  const warnings: Array<string> = [];
  for (const c of channels) {
    const v = vs[c] as Record<string, unknown> | undefined;
    const text = str(v?.text);
    if (!text) continue;
    const rule = channelRule(c);
    let tags = cleanHashtags(Array.isArray(v?.hashtags) ? (v.hashtags as Array<unknown>).map(String) : []);
    if (rule.hashtags.max === 0) tags = [];
    else if (c === "tiktok" || c === "instagram") tags = cleanHashtags([...tags, ...brand.brandHashtags]).slice(0, rule.hashtags.max);
    else tags = tags.slice(0, rule.hashtags.max);
    variants[c] = { text, hashtags: tags, note: str(v?.note) };
    if (text.length > rule.max_chars * 1.25) warnings.push(`${rule.label}: bài dài ${text.length} ký tự, nên rút gọn (gợi ý tối đa ${rule.max_chars}).`);
    for (const w of claimWarnings(text, brand.knowledge)) warnings.push(`${rule.label}: ${w}`);
  }
  if (!channels.some((c) => variants[c]?.text)) return fail("OpenClaw không viết được bài nào. Thử lại.");

  const picked = (Array.isArray(parsed.media) ? parsed.media : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= library.length).slice(0, 2);
  const media: Array<MediaRef> = [...item.media.filter((m) => !m.suggested), ...picked.map((n) => ({ ...library[n - 1], suggested: true }))];
  const pillarName = str(parsed.pillar).toLowerCase();
  const newPillar = item.pillar_id ? null : pillars.find((p) => p.name.toLowerCase() === pillarName) ?? null;
  const newTitle = item.source === "quick" ? str(parsed.title).slice(0, 200) : "";
  const ms = Date.now() - t0;

  const upd = await db.from("content_items").update({
    variants, hashtags: cleanHashtags(Array.isArray(parsed.hashtags) ? (parsed.hashtags as Array<unknown>).map(String) : item.hashtags), media,
    status: "draft", drafted_at: new Date().toISOString(), channels: [...new Set([...item.channels, ...channels])],
    ...(newPillar ? { pillar_id: newPillar.id } : {}), ...(newTitle ? { title: newTitle } : {}),
  }).eq("id", itemId).eq("workspace_id", ws).in("status", ["idea", "draft"]).select("*").single();
  if (upd.error || !upd.data) return fail(upd.error?.message ?? "Bài đã đổi trạng thái, không lưu được bản nháp.");

  await addEvidence(db, ws, itemId, { kind: "drafted", by: "NIVO", text: `OpenClaw soạn ${channels.map((c) => channelRule(c).label).join(", ")} trong ${Math.round(ms / 1000)} giây.${warnings.length ? ` Cảnh báo: ${warnings.join(" ")}` : ""}${actor ? ` Yêu cầu bởi ${actor}.` : ""}` });
  await logDecision(db, ws, { work_item_id: null, lead_id: null, department: "content", action: "draft_post", decided_by: "NIVO", decider_kind: "policy", outcome: "auto_done", reason: "routine", note: `${item.title} · ${ASSIST_NOTE}` });
  await logEvidence(db, ws, { kind: "content.drafted", actor: "NIVO", summary: `Soạn bài: ${item.title}`, evidence: channels.join(", ") });
  return { ok: true, item: toItem(upd.data as Record<string, unknown>), warnings, ms, generationId: r.generationId };
};

/** "Ý tưởng nhanh": the owner pastes a topic; a new item is created and drafted for the chosen channels. */
export const quickDraft = async (db: Db, ws: string, topic: string, channels: ReadonlyArray<ContentChannel>, actor: string, scheduledAt: string | null = null): Promise<DraftResult> => {
  const clean = topic.trim();
  if (clean.length < 3) return { ok: false, error: "Hãy nhập chủ đề, ít nhất vài chữ.", ms: 0 };
  const chans = channels.filter(isContentChannel);
  const ins = await db.from("content_items").insert({
    workspace_id: ws, title: clean.split("\n")[0].slice(0, 80), brief: clean, channels: chans.length ? chans : ["facebook"], status: "idea", source: "quick", scheduled_at: scheduledAt, created_by: actor,
    evidence: [{ at: new Date().toISOString(), kind: "created", by: actor, text: "Tạo từ Ý tưởng nhanh." }],
  }).select("id").single();
  if (ins.error || !ins.data) return { ok: false, error: ins.error?.message ?? "Không tạo được bài.", ms: 0 };
  const id = (ins.data as { id: string }).id;
  const res = await draftItem(db, ws, id, actor);
  if (!res.ok) await db.from("content_items").delete().eq("id", id).eq("workspace_id", ws);
  return res;
};

