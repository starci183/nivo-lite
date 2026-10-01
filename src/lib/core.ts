import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIME_ZONE } from "@/i18n/core";
import type { Department, FlowAction, InboundChannel, InboundEvent, InboundKind, Origin, ReasonCode } from "./flow-types";
import type { Lead } from "./types";

/**
 * NIVO CORE: permission-independent plumbing every AI step goes through — contact normalising, dedupe keys,
 * inbound intake, lead matching, the decision log and evidence. No Next.js request APIs here (usable after the response).
 */
export type Db = SupabaseClient;

/** VN phone → `84…` digits; email → lowercased. Null when empty. */
export const normaliseContact = (raw: string | null | undefined): string | null => {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v.includes("@")) return v.toLowerCase();
  let d = v.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = `84${d.slice(1)}`;
  else if (!d.startsWith("84") && d.length === 9) d = `84${d}`;
  return d;
};

/** Split a normalised contact into phone / email. */
export const contactParts = (raw: string | null) => {
  // Always normalised, so "0912 000 701" and "84912000701" match the same lead.
  const contact = normaliseContact(raw);
  return {
    phone: contact && !contact.includes("@") ? contact : null,
    email: contact && contact.includes("@") ? contact : null,
  };
};

const normaliseText = (s: string) => s.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();

/** Calendar day in Vietnam time (yyyy-mm-dd). */
export const vnDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);

/** What identifies one inbound: the channel's own event id when it has one, else the content (fallback only). */
export type DedupeParts = {
  /** The channel event id (Telegram `tg:<chat_id>:<message_id>`, simulator event code, website agent_message id). */
  eventId?: string | null;
  who: string; ref?: string | null; body: string; day?: string;
};

/**
 * The inbound idempotency key. With a channel event id: `channel:kind:<event_id>`, so the same event redelivered (any day)
 * is one input and a new event with identical text is a new input. Without one (legacy/seed callers) it falls back to the
 * content key: channel, kind, who, the external reference (or a hash of the normalised body) and the day.
 */
export const dedupeKey = (channel: InboundChannel, kind: InboundKind, p: DedupeParts) => {
  const id = p.eventId?.trim();
  if (id) return `${channel}:${kind}:${id}`;
  const r = p.ref?.trim() ? normaliseText(p.ref) : createHash("sha1").update(normaliseText(p.body)).digest("hex").slice(0, 16);
  return `${channel}:${kind}:${normaliseText(p.who) || "-"}:${r}:${p.day ?? vnDay()}`;
};

/** Append-only evidence / audit line (events), linked to the work item. */
export const logEvidence = async (
  db: Db, ws: string,
  e: { lead_id?: string | null; work_item_id?: string | null; kind: string; actor: string; summary: string; evidence?: string | null },
) => {
  await db.from("events").insert({
    workspace_id: ws, lead_id: e.lead_id ?? null, work_item_id: e.work_item_id ?? null, kind: e.kind, actor: e.actor,
    summary: e.summary, evidence: e.evidence ?? null,
  });
};

/** The decision log: who decided, how (policy or person), the outcome and why. Append-only. */
export const logDecision = async (
  db: Db, ws: string,
  d: {
    work_item_id: string | null; lead_id: string | null; department: Department; action: FlowAction; decided_by: string;
    decider_kind: "policy" | "owner" | "staff"; outcome: "auto_done" | "approved" | "edited" | "rejected";
    reason?: ReasonCode | null; note?: string | null; before?: unknown; after?: unknown;
  },
) => {
  const { error } = await db.from("decisions").insert({
    workspace_id: ws, work_item_id: d.work_item_id, lead_id: d.lead_id, department: d.department, action: d.action,
    decided_by: d.decided_by, decider_kind: d.decider_kind, outcome: d.outcome, reason: d.reason ?? null, note: d.note ?? null,
    before: d.before ?? null, after: d.after ?? null,
  });
  if (error) throw new Error(error.message);
};

export type IngestInput = {
  channel: InboundChannel; kind: InboundKind; origin: Origin; sender_name: string | null; sender_contact: string | null;
  body: string; amount_vnd: number | null; external_ref: string | null;
  /** The channel's own event id; the idempotency key when present (see {@link dedupeKey}). */
  event_id?: string | null;
};

/**
 * Record one input, idempotently by its channel event id. The same event (same dedupe key) is stored once: a redelivery
 * increments `duplicate_count` and logs `core.duplicate_blocked`, and the caller must not start any new work for it.
 */
export const ingest = async (db: Db, ws: string, input: IngestInput, duplicateSummary: (n: number) => string): Promise<{ event: InboundEvent; duplicate: boolean }> => {
  const contact = normaliseContact(input.sender_contact);
  const { event_id, ...fields } = input;
  const eventId = event_id?.trim() || null;
  const key = dedupeKey(input.channel, input.kind, { eventId, who: contact ?? input.sender_name ?? "", ref: input.external_ref, body: input.body });
  const ins = await db.from("inbound_events").upsert(
    { workspace_id: ws, ...fields, ...(eventId ? { event_id: eventId } : {}), sender_contact: contact, dedupe_key: key },
    { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true },
  ).select();
  if (ins.error) throw new Error(ins.error.message);
  const row = (ins.data ?? [])[0] as InboundEvent | undefined;
  if (row) return { event: row, duplicate: false };

  const existing = await db.from("inbound_events").select("*").eq("workspace_id", ws).eq("dedupe_key", key).single<InboundEvent>();
  if (existing.error) throw new Error(existing.error.message);
  const n = existing.data.duplicate_count + 1;
  const upd = await db.from("inbound_events").update({ duplicate_count: n, last_duplicate_at: new Date().toISOString() })
    .eq("id", existing.data.id).select().single<InboundEvent>();
  await logEvidence(db, ws, { lead_id: existing.data.lead_id, kind: "core.duplicate_blocked", actor: "NIVO", summary: duplicateSummary(n), evidence: key });
  return { event: upd.data ?? { ...existing.data, duplicate_count: n }, duplicate: true };
};

/** Find the customer this input belongs to: by phone, then email, then exact name + channel. */
export const matchLead = async (
  db: Db, ws: string, m: { phone?: string | null; email?: string | null; name?: string | null; channel?: string | null },
): Promise<Lead | null> => {
  if (m.phone) {
    const { data } = await db.from("leads").select("*").eq("workspace_id", ws).eq("phone", m.phone).order("created_at").limit(1);
    if (data?.[0]) return data[0] as Lead;
  }
  if (m.email) {
    const { data } = await db.from("leads").select("*").eq("workspace_id", ws).eq("email", m.email).order("created_at").limit(1);
    if (data?.[0]) return data[0] as Lead;
  }
  // A same name is not evidence of the same person: fall back to name + channel only when the input carries no contact
  // at all. An input with a phone/email that matched nobody is a new customer, even if another "Anh Minh" exists.
  if (!m.phone && !m.email && m.name?.trim() && m.channel) {
    const { data } = await db.from("leads").select("*").eq("workspace_id", ws).eq("contact_name", m.name.trim()).eq("channel", m.channel).order("created_at").limit(1);
    if (data?.[0]) return data[0] as Lead;
  }
  return null;
};
