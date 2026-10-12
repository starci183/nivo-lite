/**
 * Pure rules of "Office @agent -> command" (no I/O, no runtime imports): finding which customer / order a message names, reading the model's choice,
 * and turning it into a payload that satisfies the agent's `accepts` contract. office-command.ts runs them against the database and the
 * one metered model call; this file is what can be checked with plain node.
 *
 * The model only PICKS (a command of that agent's list, ids out of the references we offered, short values for non-id required fields).
 * Everything it returns is validated here: a command that is not in the list, an id that was not offered or a missing required key never
 * becomes a candidate.
 */

import type { ModuleKey } from "./module-registry";

export type CandidateRow = { readonly key: string; readonly label: string; readonly value: string };
export type CommandCandidate = {
  readonly id: string;
  readonly message_id: string;
  readonly module: ModuleKey;
  readonly command: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly summary: string;
  readonly shown: ReadonlyArray<CandidateRow>;
  readonly status: "pending" | "sent" | "cancelled";
  readonly work_item_id: string | null;
  readonly refusal_detail: string | null;
  readonly created_at: string;
};

export type AcceptedCommand = {
  readonly command: string;
  readonly subjectType: string;
  readonly requiredFields: ReadonlyArray<string>;
  readonly description: { readonly vi: string; readonly en: string };
};
export type LeadRef = { readonly id: string; readonly name: string; readonly company?: string | null };
export type OrderRef = { readonly id: string; readonly orderNo: string; readonly leadId: string | null };

/** The model's raw choice, after parsing (nothing validated yet). */
export type CommandChoice = {
  readonly command: string | null;
  readonly subjectId: string | null;
  readonly leadId: string | null;
  readonly fields: Readonly<Record<string, string | number>>;
};

export type Resolution =
  | { readonly kind: "unmapped" }
  | { readonly kind: "missing"; readonly accepted: AcceptedCommand; readonly missing: ReadonlyArray<string> }
  | {
      readonly kind: "ok";
      readonly accepted: AcceptedCommand;
      readonly payload: Readonly<Record<string, unknown>>;
      readonly leadId: string | null;
      readonly orderId: string | null;
      readonly extra: Readonly<Record<string, string | number>>;
    };

/** Handles ("@ke-toan") named in a message, lower case, in order, without repeats. */
export const mentionedHandles = (body: string): Array<string> => [...new Set([...body.matchAll(/@([a-z0-9-]+)/g)].map((m) => m[1]))];

/** Lower case, no accents (đ -> d): how names and order numbers are compared. */
export const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

/** The message as comparable tokens: mentions removed, folded, "#DH-1" -> "dh1". */
const tokensOf = (body: string): Array<string> =>
  fold(body.replace(/@[a-z0-9-]+/gi, " "))
    .split(/[\s,;:!?()"“”]+/)
    .map((t) => t.replace(/^#/, "").replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

const orderKey = (no: string): string => fold(no).replace(/[^a-z0-9]/g, "");

/** Orders whose number the message names ("#DH-12", "dh12", "đơn DH-12"). */
export const matchOrders = (body: string, orders: ReadonlyArray<OrderRef>): Array<OrderRef> => {
  const tokens = new Set(tokensOf(body));
  return orders.filter((o) => {
    const key = orderKey(o.orderNo);
    return key.length > 0 && tokens.has(key);
  });
};

/**
 * Customers the message names: the full name (strongest), else the given name (last word, at least 3 letters) or the company.
 * Only the strongest tier is returned, so "Lan" does not beat "Nguyễn Thị Lan" when both are in the list.
 */
export const matchLeads = (body: string, leads: ReadonlyArray<LeadRef>): Array<LeadRef> => {
  const text = ` ${tokensOf(body).join(" ")} `;
  const whole = (phrase: string) => phrase.length > 0 && text.includes(` ${phrase} `);
  const phraseOf = (s: string) => tokensOf(s).join(" ");
  const scored = leads.map((l) => {
    const full = phraseOf(l.name);
    const parts = full.split(" ").filter(Boolean);
    const given = parts[parts.length - 1] ?? "";
    const company = l.company ? phraseOf(l.company) : "";
    const score = whole(full) ? 3 : company.length >= 3 && whole(company) ? 2 : given.length >= 3 && whole(given) ? 1 : 0;
    return { l, score };
  });
  const best = Math.max(0, ...scored.map((s) => s.score));
  return best === 0 ? [] : scored.filter((s) => s.score === best).map((s) => s.l);
};

/** "xuất phiếu thu; đối soát khoản thanh toán": what an agent accepts, for the reply when a message maps to nothing. */
export const acceptsText = (locale: "vi" | "en", accepts: ReadonlyArray<AcceptedCommand>): string =>
  accepts.map((a) => a.description[locale]).join("; ");

/** Reads the model's JSON (tolerating a code fence or surrounding words). Null when there is no object to read. */
export const readCommandChoice = (raw: string): CommandChoice | null => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const fields: Record<string, string | number> = {};
  if (o.fields && typeof o.fields === "object") {
    for (const [k, v] of Object.entries(o.fields as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) fields[k] = v;
      else if (typeof v === "string" && v.trim()) fields[k] = v.trim();
    }
  }
  return { command: str(o.command), subjectId: str(o.subject_id), leadId: str(o.lead_id), fields };
};

const ID_KEYS = ["subject_id", "lead_id"] as const;

/**
 * Validates the choice against the agent's contract. `leads` and `orders` are the references the message named (the only ids the model was
 * offered); an id outside them is dropped, and a single named reference is used when the model left the id out.
 */
export const resolveCandidate = (
  choice: CommandChoice | null,
  accepts: ReadonlyArray<AcceptedCommand>,
  refs: { readonly leads: ReadonlyArray<LeadRef>; readonly orders: ReadonlyArray<OrderRef> },
): Resolution => {
  if (!choice?.command) return { kind: "unmapped" };
  const accepted = accepts.find((a) => a.command === choice.command);
  if (!accepted) return { kind: "unmapped" };

  const wanted = choice.subjectId ?? choice.leadId;
  let orderId: string | null = null;
  let leadId: string | null = null;
  const payload: Record<string, unknown> = { subject_type: accepted.subjectType };

  if (accepted.subjectType === "order") {
    const order = refs.orders.find((o) => o.id === wanted) ?? (refs.orders.length === 1 ? refs.orders[0] : undefined);
    if (order) {
      orderId = order.id;
      leadId = order.leadId;
      payload.subject_id = order.id;
      if (order.leadId) payload.lead_id = order.leadId;
    }
  } else if (accepted.subjectType === "lead") {
    const lead = refs.leads.find((l) => l.id === wanted);
    const only = refs.leads.length === 1 ? refs.leads[0].id : null;
    const viaOrder = refs.orders.length === 1 ? refs.orders[0].leadId : null;
    leadId = lead?.id ?? only ?? viaOrder;
    if (leadId) {
      payload.subject_id = leadId;
      payload.lead_id = leadId;
    }
  }

  const extra: Record<string, string | number> = {};
  const missing: Array<string> = [];
  for (const key of accepted.requiredFields) {
    if ((ID_KEYS as ReadonlyArray<string>).includes(key)) {
      if (payload[key] === undefined) missing.push(key);
      continue;
    }
    const v = choice.fields[key];
    if (v === undefined) missing.push(key);
    else {
      extra[key] = v;
      payload[key] = v;
    }
  }
  return missing.length ? { kind: "missing", accepted, missing } : { kind: "ok", accepted, payload, leadId, orderId, extra };
};
