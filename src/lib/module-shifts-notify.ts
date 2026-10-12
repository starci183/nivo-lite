import "server-only";
import { activeStaff, officeStaffHandles } from "./staff-relay";
import type { EngineCtx } from "./engine";
import { supabaseAdmin } from "./supabase/admin";
import { connectionsFor } from "./agent-bindings";
import { resolveBotToken } from "./channels";
import { telegramSend } from "./telegram";
import { getAccessToken } from "./zalo";
import { sendCsText } from "./zalo-api";
import type { ShiftStaff } from "./module-shifts-types";

/**
 * Messages of the module to people. Only ever called from a performer (after the authority gate) or for an alert to the owner.
 * Office is always used (one group chat, the person is @tagged); Telegram and Zalo are added when the person is linked (chat id / Zalo user id)
 * AND a connection of that provider is bound to the shifts agent for outbound_chat (agent_connections, via lib/agent-bindings). With none bound the
 * message goes to Office only and the attempt is recorded as "skipped". Each message leaves one `shifts_notifications` row per channel as evidence, sent or failed.
 */
export type NotifyKind = "publish" | "reminder" | "swap" | "leave" | "no_show" | "gap" | "payroll";
type Link = { scheduleId?: string | null; shiftId?: string | null; workItemId?: string | null };

const record = async (c: EngineCtx, row: { staffId: string | null; kind: NotifyKind; channel: "office" | "telegram" | "zalo"; status: "sent" | "failed" | "skipped"; body: string; error?: string | null } & Link) => {
  await supabaseAdmin().from("shifts_notifications").insert({
    workspace_id: c.ws, staff_id: row.staffId, schedule_id: row.scheduleId ?? null, shift_id: row.shiftId ?? null, kind: row.kind, channel: row.channel, status: row.status, body: row.body.slice(0, 4000), error: row.error ?? null,
  });
};

/** One line in Office from NIVO. */
export const postOffice = async (c: EngineCtx, body: string, workItemId: string | null = null): Promise<void> => {
  await c.db.from("messages").insert({ workspace_id: c.ws, author_kind: "system", author_name: "NIVO", agent_id: null, body, lead_id: null, work_item_id: workItemId });
};

export const handleMap = async (c: EngineCtx): Promise<Map<string, string>> => officeStaffHandles(c, await activeStaff(c));

/**
 * The connection the shifts agent speaks through for one provider: only a connected one it is bound to with `outbound_chat`
 * (lib/agent-bindings connectionsFor). Never "any connected Telegram/Zalo of the workspace". Null: not bound, so that channel is skipped.
 */
export const shiftsConnection = async (c: EngineCtx, provider: "telegram" | "zalo_oa"): Promise<string | null> => {
  const { data } = await c.db.from("agents").select("id").eq("workspace_id", c.ws).eq("module", "shifts").eq("status", "active").order("created_at").limit(1);
  const agentId = (data as Array<{ id: string }> | null)?.[0]?.id;
  if (!agentId) return null;
  return (await connectionsFor(agentId, "outbound_chat", { acting: true, connectedOnly: true, providers: [provider] }))[0]?.id ?? null;
};

/** True when at least one Telegram / Zalo connection is bound to the shifts agent (settings show a hint when not). */
export const shiftsHasChannel = async (c: EngineCtx): Promise<boolean> => (await shiftsConnection(c, "telegram")) !== null || (await shiftsConnection(c, "zalo_oa")) !== null;

const NOT_BOUND = "Chưa gắn kênh cho agent Ca làm";

const viaTelegram = async (c: EngineCtx, chatId: string, text: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
  try {
    const connectionId = await shiftsConnection(c, "telegram");
    if (!connectionId) return { ok: false, skipped: true, error: NOT_BOUND };
    const token = await resolveBotToken(c.ws, connectionId);
    if (!token) return { ok: false, error: "Chưa kết nối Telegram" };
    await telegramSend(token, chatId, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "Telegram lỗi" };
  }
};

const viaZalo = async (c: EngineCtx, userId: string, text: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
  try {
    const connectionId = await shiftsConnection(c, "zalo_oa");
    if (!connectionId) return { ok: false, skipped: true, error: NOT_BOUND };
    await sendCsText(await getAccessToken(connectionId), userId, text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "Zalo lỗi" };
  }
};

/** Tell one person: Office (tagged) and, when linked, Telegram / Zalo. Never throws: a failed channel is recorded and the others still go. */
export const notifyStaff = async (c: EngineCtx, p: ShiftStaff, kind: NotifyKind, body: string, link: Link = {}): Promise<{ office: boolean; telegram: boolean | null; zalo: boolean | null }> => {
  const handles = await handleMap(c).catch(() => new Map<string, string>());
  const handle = p.staffRowId ? handles.get(p.staffRowId) : undefined;
  const tagged = handle ? `@${handle} ${body}` : `${p.name}: ${body}`;
  let office = true;
  try {
    await postOffice(c, tagged, link.workItemId ?? null);
    await record(c, { staffId: p.id, kind, channel: "office", status: "sent", body: tagged, ...link });
  } catch (e) {
    office = false;
    await record(c, { staffId: p.id, kind, channel: "office", status: "failed", body: tagged, error: e instanceof Error ? e.message : String(e), ...link }).catch(() => null);
  }
  let telegram: boolean | null = null;
  if (p.telegramChatId) {
    const r = await viaTelegram(c, p.telegramChatId, body);
    telegram = r.skipped ? null : r.ok;
    await record(c, { staffId: p.id, kind, channel: "telegram", status: r.ok ? "sent" : r.skipped ? "skipped" : "failed", body, error: r.error ?? null, ...link });
  }
  let zalo: boolean | null = null;
  if (p.zaloUserId) {
    const r = await viaZalo(c, p.zaloUserId, body);
    zalo = r.skipped ? null : r.ok;
    await record(c, { staffId: p.id, kind, channel: "zalo", status: r.ok ? "sent" : r.skipped ? "skipped" : "failed", body, error: r.error ?? null, ...link });
  }
  return { office, telegram, zalo };
};

/** An alert for the owner and managers (no-show, a gap after leave, the monthly summary): Office, with evidence. */
export const notifyManagers = async (c: EngineCtx, kind: NotifyKind, body: string, link: Link = {}): Promise<void> => {
  await postOffice(c, body, link.workItemId ?? null);
  await record(c, { staffId: null, kind, channel: "office", status: "sent", body, ...link });
};
