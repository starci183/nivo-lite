import "server-only";
import { logEvidence } from "./core";
import { draftItem } from "./module-content-ai";
import { channelLabel, pad2, vnDateKey, vnParts, vnToIso, weekStartKey, type AutomationKey, type ContentChannel, type ContentItem } from "./module-content-shared";
import { listCadence, listItems, listPillars, loadSettings, saveSettings, type Db } from "./module-content-store";

/**
 * The three content automations. Each is a switch on the workbench ("Tự động"); the quarter-hour tick (migration 20261012100000 -> POST /api/content/tick)
 * calls runContentTick, which runs the ones that are due for each workspace. Nothing here posts anywhere: a reminder and a summary are
 * messages in Office, and the offer draft is a draft that still goes through approval.
 *   today_reminder   from 07:00 (Vietnam time): what is due to be posted today, and what is still not approved
 *   weekly_summary   Monday from 08:00: last week's posts and the balance across pillars
 *   offer_draft      a knowledge source about a new offer (price list / promotion) appeared: draft a post about it
 */

const OFFER_RE = /ưu đãi|khuyến mãi|giảm giá|combo|gói |tặng |miễn phí|khai trương|sự kiện|promo|offer|sale/i;

const office = (db: Db, ws: string, body: string) =>
  db.from("messages").insert({ workspace_id: ws, author_kind: "system", author_name: "NIVO", agent_id: null, body, lead_id: null, work_item_id: null });

const hhmm = (iso: string): string => { const p = vnParts(new Date(iso)); return `${pad2(p.h)}:${pad2(p.min)}`; };
const STATUS_VI: Record<ContentItem["status"], string> = { idea: "mới là ý tưởng", draft: "bản nháp, chưa gửi duyệt", waiting_approval: "đang chờ bạn duyệt", approved: "đã duyệt, sẵn sàng đăng", published: "đã đăng", skipped: "đã bỏ qua" };

export type TickResult = { workspace: string; job: AutomationKey; did: string }[];

type RunOpts = { now?: Date; /** ignore the time window and the "already done" marks (operator check) */ force?: boolean; only?: string };

export const runContentTick = async (db: Db, o: RunOpts = {}): Promise<TickResult> => {
  const now = o.now ?? new Date();
  const q = db.from("content_settings").select("workspace_id, automations");
  const { data } = o.only ? await q.eq("workspace_id", o.only) : await q;
  const out: TickResult = [];
  for (const row of (data ?? []) as Array<{ workspace_id: string; automations: Partial<Record<AutomationKey, boolean>> }>) {
    const ws = row.workspace_id;
    const on = row.automations ?? {};
    try {
      if (on.today_reminder) { const r = await todayReminder(db, ws, now, !!o.force); if (r) out.push({ workspace: ws, job: "today_reminder", did: r }); }
      if (on.weekly_summary) { const r = await weeklySummary(db, ws, now, !!o.force); if (r) out.push({ workspace: ws, job: "weekly_summary", did: r }); }
      if (on.offer_draft) { const r = await offerDraft(db, ws, now, !!o.force); if (r) out.push({ workspace: ws, job: "offer_draft", did: r }); }
    } catch (e) {
      console.error(`content tick ${ws} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
};

export const todayReminder = async (db: Db, ws: string, now: Date, force: boolean): Promise<string | null> => {
  const p = vnParts(now);
  const today = vnDateKey(now);
  const s = await loadSettings(db, ws);
  if (!force && (p.h < 7 || s.marks.reminder_day === today)) return null;
  const items = await listItems(db, ws, { from: vnToIso(p.y, p.m, p.day), to: vnToIso(p.y, p.m, p.day + 1) });
  const due = items.filter((i) => i.status !== "published" && i.status !== "skipped");
  if (due.length) {
    const lines = due.map((i) => `- ${i.scheduled_at ? hhmm(i.scheduled_at) : "--:--"} ${i.channels.map(channelLabel).join(", ")}: ${i.title} (${STATUS_VI[i.status]})`);
    const notReady = due.filter((i) => i.status !== "approved").length;
    await office(db, ws, `Hôm nay có ${due.length} bài cần đăng:\n${lines.join("\n")}${notReady ? `\n${notReady} bài chưa được duyệt. Mở Nội dung để soạn và duyệt trước giờ đăng.` : "\nTất cả đã duyệt. Mở Nội dung để sao chép và đăng."}`);
    await logEvidence(db, ws, { kind: "content.reminder", actor: "NIVO", summary: `Nhắc lịch đăng bài hôm nay: ${due.length} bài`, evidence: today });
  }
  await saveSettings(db, ws, { marks: { reminder_day: today } });
  return due.length ? `nhắc ${due.length} bài` : "hôm nay không có bài";
};

export const weeklySummary = async (db: Db, ws: string, now: Date, force: boolean): Promise<string | null> => {
  const p = vnParts(now);
  const thisWeek = weekStartKey(now);
  const s = await loadSettings(db, ws);
  if (!force && (p.dow !== 1 || p.h < 8 || s.marks.summary_week === thisWeek)) return null;
  const [y, m, d] = thisWeek.split("-").map(Number);
  const from = vnToIso(y, m, d - 7);
  const to = vnToIso(y, m, d);
  const [items, pillars] = await Promise.all([listItems(db, ws, { from, to }), listPillars(db, ws)]);
  const count = (st: ContentItem["status"]) => items.filter((i) => i.status === st).length;
  const byPillar = pillars.map((pl) => ({ name: pl.name, n: items.filter((i) => i.pillar_id === pl.id && i.status !== "skipped").length })).filter((x) => x.n > 0);
  const missed = items.filter((i) => i.status === "approved" || i.status === "draft" || i.status === "waiting_approval").length;
  const body = items.length
    ? `Tổng kết nội dung tuần qua: ${items.length} bài lên lịch, ${count("published")} đã đăng, ${missed} chưa đăng, ${count("skipped")} bỏ qua.${byPillar.length ? `\nTheo chủ đề: ${byPillar.map((x) => `${x.name} ${x.n}`).join(", ")}.` : ""}${missed ? "\nCòn bài chưa đăng: kiểm tra lại lịch và đăng hoặc bỏ qua." : ""}`
    : "Tổng kết nội dung tuần qua: không có bài nào lên lịch. Mở Nội dung và bấm Lên kế hoạch tháng để có ý tưởng cho tuần này.";
  await office(db, ws, body);
  await logEvidence(db, ws, { kind: "content.weekly_summary", actor: "NIVO", summary: `Tổng kết nội dung tuần: ${items.length} bài`, evidence: thisWeek });
  await saveSettings(db, ws, { marks: { summary_week: thisWeek } });
  return `tổng kết ${items.length} bài`;
};

export const offerDraft = async (db: Db, ws: string, now: Date, force: boolean): Promise<string | null> => {
  const s = await loadSettings(db, ws);
  const seen = s.marks.offer_seen_at;
  if (!seen && !force) {
    // The first run only remembers "now": offers that already existed when the owner switched this on are not turned into posts.
    await saveSettings(db, ws, { marks: { offer_seen_at: now.toISOString() } });
    return null;
  }
  const since = seen ?? new Date(0).toISOString();
  const { data } = await db.from("knowledge_sources").select("id, title, topic, kind, content, module, updated_at").eq("workspace_id", ws).eq("status", "ready").gt("updated_at", since).order("updated_at").limit(5);
  const fresh = ((data ?? []) as Array<{ id: string; title: string; topic: string | null; kind: string; content: string; module: string | null; updated_at: string }>)
    .filter((r) => (!r.module || r.module === "content") && (OFFER_RE.test(`${r.title} ${r.topic ?? ""} ${r.content.slice(0, 400)}`)))
    .slice(0, 2);
  if (!fresh.length) return null;
  const [pillars, cadence] = await Promise.all([listPillars(db, ws), listCadence(db, ws)]);
  const offerPillar = pillars.find((pl) => pl.active && /ưu đãi|khuyến mãi|offer|promo/i.test(pl.name)) ?? null;
  const channels: Array<ContentChannel> = cadence.filter((c) => c.posts_per_week > 0).map((c) => c.channel);
  let made = 0;
  let handled = 0;
  for (const src of fresh) {
    const title = `Bài về: ${src.title}`.slice(0, 200);
    // A source already turned into a post (earlier tick) is not drafted twice; one whose draft failed is retried on the next tick.
    const prior = await db.from("content_items").select("id, status").eq("workspace_id", ws).eq("source", "offer").eq("title", title).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const old = prior.data as { id: string; status: string } | null;
    if (old && old.status !== "idea") { handled += 1; continue; }
    let id = old?.id;
    if (!id) {
      const ins = await db.from("content_items").insert({
        workspace_id: ws, title, brief: `Có thông tin mới trong tri thức: "${src.title}". Viết bài giới thiệu đúng những gì nguồn này nói, không thêm ưu đãi nào khác.`,
        pillar_id: offerPillar?.id ?? null, channels: channels.length ? channels : ["facebook"], status: "idea", source: "offer", created_by: "NIVO",
        evidence: [{ at: now.toISOString(), kind: "created", by: "NIVO", text: `Tự soạn vì có nguồn mới: ${src.title}.` }],
      }).select("id").single();
      if (ins.error || !ins.data) continue;
      id = (ins.data as { id: string }).id;
    }
    const r = await draftItem(db, ws, id, "NIVO");
    if (r.ok) { made += 1; handled += 1; }
  }
  // The mark moves forward only when every fresh source was handled; otherwise the next tick tries the rest again.
  if (handled === fresh.length) {
    const latest = fresh[fresh.length - 1].updated_at;
    await saveSettings(db, ws, { marks: { offer_seen_at: latest > now.toISOString() ? latest : now.toISOString() } });
  }
  if (made) await office(db, ws, `Có ${made} bản nháp mới từ ưu đãi vừa thêm. Mở Nội dung để đọc và gửi duyệt.`);
  return `soạn ${made}/${fresh.length} bài từ ưu đãi mới`;
};
