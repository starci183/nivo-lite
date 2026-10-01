"use server";

import { createHmac, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { decryptSecret, encryptSecret, randomSecret } from "./channels";
import { requireManager } from "./permissions";
import { assertPublicTarget } from "./outbound-guard";
import { eventsOf, workspaceSigningSecret } from "./outbound-events";
import { isWebhookEvent, type WebhookEvent } from "./webhook-shared";
import { supabaseAdmin } from "./supabase/admin";
import type { Outcome } from "./types";

/**
 * The "n8n / Webhook" connection (provider `webhook`): the owner enters a URL and picks events; NIVO shows the signing secret (derived per workspace, the same
 * key the engine signs `n8n.emit` deliveries with) and can send a signed sample event. The URL is stored encrypted (connection_secrets), the chosen events in
 * public_meta.events. Delivery itself is src/lib/outbound-events.ts (engine job n8n.emit). Owner and manager only.
 */
const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export type WebhookView = { id: string; name: string; host: string; events: Array<WebhookEvent>; signingSecret: string };
export type WebhookTestResult = { ok: boolean; status: number | null; error: string | null; durationMs: number };

const pickEvents = (events: ReadonlyArray<string>): Array<WebhookEvent> => {
  const picked = events.filter(isWebhookEvent);
  if (picked.length === 0) throw new Error("Chọn ít nhất một sự kiện để gửi.");
  return [...new Set(picked)];
};

const secretOrThrow = (ws: string): string => {
  const s = workspaceSigningSecret(ws);
  if (!s) throw new Error("NIVO chưa bật chữ ký cho webhook trên máy chủ này (thiếu ENGINE_SHARED_SECRET).");
  return s;
};

const ownWebhook = async (ws: string, id: string): Promise<{ id: string; name: string; status: string; meta: Record<string, string> }> => {
  const { data } = await supabaseAdmin().from("connections").select("id, name, status, public_meta").eq("id", id).eq("workspace_id", ws).eq("provider", "webhook").maybeSingle();
  const c = data as { id: string; name: string; status: string; public_meta: Record<string, string> | null } | null;
  if (!c) throw new Error("Không tìm thấy kết nối này.");
  return { id: c.id, name: c.name, status: c.status, meta: c.public_meta ?? {} };
};

const urlOf = async (connectionId: string): Promise<string> => {
  const { data } = await supabaseAdmin().from("connection_secrets").select("ciphertext").eq("connection_id", connectionId).maybeSingle();
  const sec = data as { ciphertext: string } | null;
  const url = sec ? (JSON.parse(decryptSecret(sec.ciphertext)) as { url?: string }).url : null;
  if (!url) throw new Error("Kết nối này chưa có địa chỉ webhook.");
  return url;
};

/** Wizard step "địa chỉ + sự kiện": create the connection as PENDING and return the signing secret to copy. */
export const startWebhookConnection = async (input: { name: string; url: string; events: ReadonlyArray<string> }): Promise<Outcome<WebhookView>> =>
  run(async () => {
    const member = await requireManager();
    const name = input.name.trim().slice(0, 60);
    if (name.length < 2) throw new Error("Đặt tên cho kết nối (ít nhất 2 ký tự), ví dụ: n8n của shop.");
    const events = pickEvents(input.events);
    const url = await assertPublicTarget(input.url);
    const signingSecret = secretOrThrow(member.workspaceId);
    const db = supabaseAdmin();
    const { data: row, error } = await db.from("connections").insert({
      workspace_id: member.workspaceId, provider: "webhook", name, status: "pending", environment: "live", created_by: member.userId,
      public_meta: { host: url.host, events: events.join(",") },
    }).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "Không lưu được kết nối.");
    const saved = await db.from("connection_secrets").insert({ connection_id: row.id as string, ciphertext: encryptSecret(JSON.stringify({ url: url.toString() })), webhook_secret: randomSecret() });
    if (saved.error) {
      await db.from("connections").delete().eq("id", row.id as string);
      throw new Error(saved.error.message);
    }
    revalidatePath("/", "layout");
    return { id: row.id as string, name, host: url.host, events, signingSecret };
  });

/** Show the signing secret and the chosen events again (owner or manager). */
export const revealWebhook = async (connectionId: string): Promise<Outcome<WebhookView>> =>
  run(async () => {
    const member = await requireManager();
    const c = await ownWebhook(member.workspaceId, connectionId);
    return { id: c.id, name: c.name, host: c.meta.host ?? "", events: eventsOf(c.meta), signingSecret: secretOrThrow(member.workspaceId) };
  });

/** Change which events a webhook connection receives. */
export const updateWebhookEvents = async (connectionId: string, events: ReadonlyArray<string>): Promise<Outcome<Array<WebhookEvent>>> =>
  run(async () => {
    const member = await requireManager();
    const c = await ownWebhook(member.workspaceId, connectionId);
    const picked = pickEvents(events);
    const { error } = await supabaseAdmin().from("connections").update({ public_meta: { ...c.meta, events: picked.join(",") }, updated_at: new Date().toISOString() }).eq("id", c.id);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return picked;
  });

/** Wizard step "gửi thử": POST a signed sample event (same headers and signature as a real delivery) and report the HTTP status the receiver answered. */
export const sendWebhookTest = async (connectionId: string): Promise<Outcome<WebhookTestResult>> =>
  run(async () => {
    const member = await requireManager();
    const c = await ownWebhook(member.workspaceId, connectionId);
    const target = await assertPublicTarget(await urlOf(c.id));
    const key = secretOrThrow(member.workspaceId);
    const id = randomUUID();
    const body = JSON.stringify({
      id, event: "lead.created", workspace_id: member.workspaceId, occurred_at: new Date().toISOString(),
      data: { test: true, lead_id: "00000000-0000-0000-0000-000000000000", name: "Khách thử NIVO", phone: "0900000000", need: "Đây là sự kiện thử từ NIVO." },
    });
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
    const started = Date.now();
    try {
      const res = await fetch(target, {
        method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
        headers: { "content-type": "application/json", "x-nivo-event": "lead.created", "x-nivo-delivery": id, "x-nivo-timestamp": timestamp, "x-nivo-signature": signature, "x-nivo-test": "1" },
        body,
      });
      const ok = res.status >= 200 && res.status < 300;
      await supabaseAdmin().from("connections").update({ last_error: ok ? null : `HTTP ${res.status}`, updated_at: new Date().toISOString() }).eq("id", c.id);
      return { ok, status: res.status, error: ok ? null : `Nơi nhận trả lỗi HTTP ${res.status}.`, durationMs: Date.now() - started };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, status: null, error: /timeout|abort/i.test(msg) ? "Nơi nhận không trả lời trong 10 giây." : "Không kết nối được tới địa chỉ webhook.", durationMs: Date.now() - started };
    }
  });

/** Wizard last step: mark the connection live (events start flowing). */
export const finishWebhookConnection = async (connectionId: string): Promise<Outcome<true>> =>
  run(async () => {
    const member = await requireManager();
    const c = await ownWebhook(member.workspaceId, connectionId);
    const { error } = await supabaseAdmin().from("connections").update({ status: "connected", last_error: null, updated_at: new Date().toISOString() }).eq("id", c.id);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return true as const;
  });
