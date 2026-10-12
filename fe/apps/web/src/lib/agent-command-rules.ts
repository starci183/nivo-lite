/**
 * Pure rules of the agent command bus (no I/O, no imports at runtime): payload validation, depth and cycle limits, the dedupe key and
 * the Office mirror sentence. agent-commands.ts runs them against the database; this file is what can be checked with plain node.
 */

/** A chain longer than this many hops is refused (the longest real chain today is 3: handoff_lead -> classify_lead -> send_follow_up). */
export const MAX_COMMAND_DEPTH = 6;

/** The author name of a command mirror line in the Office. The Office keeps it a NIVO system line (it must not be re-attributed to an agent). */
export const COMMAND_LINE_AUTHOR = "NIVO Bus";

/** Payload keys that address the work item itself; every other payload key becomes a field of the receiver's proposal. */
export const ENVELOPE_KEYS = ["subject_type", "subject_id", "lead_id"] as const;

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Required payload keys the sender did not supply. */
export const missingPayload = (requiredFields: ReadonlyArray<string>, payload: Readonly<Record<string, unknown>>): Array<string> =>
  requiredFields.filter((f) => isEmpty(payload[f]));

/** Splits a payload into the work item's address and the proposal fields. */
export const splitPayload = (payload: Readonly<Record<string, unknown>>, defaultSubjectType: string) => {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) if (!(ENVELOPE_KEYS as ReadonlyArray<string>).includes(k)) fields[k] = v;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  return {
    subjectType: str(payload.subject_type) ?? defaultSubjectType,
    subjectId: str(payload.subject_id),
    leadId: str(payload.lead_id),
    fields,
  };
};

/** True when the next hop would be deeper than the limit. `depth` is the depth the new item would get (root = 0). */
export const tooDeep = (depth: number): boolean => depth > MAX_COMMAND_DEPTH;

/** The default idempotency key: the same command about the same subject is one piece of work. */
export const defaultDedupeKey = (command: string, subjectType: string, subjectId: string | null): string => `cmd:${command}:${subjectType}:${subjectId ?? "none"}`;

type Locale = "vi" | "en";
const SUBJECT_WORD: Record<Locale, Record<string, string>> = {
  vi: { order: "đơn", lead: "khách", invoice: "hóa đơn", transaction: "giao dịch", conversation: "cuộc chat", purchase_order: "đơn nhập", video_project: "video" },
  en: { order: "order", lead: "customer", invoice: "invoice", transaction: "transaction", conversation: "chat", purchase_order: "purchase order", video_project: "video" },
};

/** "đơn #DH-1" / "customer Lan"; empty when the subject has no readable label. */
export const subjectPhrase = (locale: Locale, subjectType: string, label: string | null): string => {
  if (!label) return "";
  const word = SUBJECT_WORD[locale][subjectType];
  const shown = subjectType === "order" && !label.startsWith("#") ? `#${label}` : label;
  return word ? `${word} ${shown}` : shown;
};

/** The Office mirror: "@Kế toán ← Bán hàng: xuất phiếu thu cho đơn #DH-1". */
export const mirrorText = (m: { locale: Locale; toName: string; fromName: string; what: string; subject: string }): string =>
  `@${m.toName} ← ${m.fromName}: ${m.what}${m.subject ? ` ${m.locale === "vi" ? "cho" : "for"} ${m.subject}` : ""}`;
