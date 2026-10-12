import type { DecisionRow } from "@/lib/flow-types";

/** Badge tone for a decision outcome. */
export const outcomeTone = (outcome: DecisionRow["outcome"]): "success" | "accent" | "warning" | "danger" => {
  if (outcome === "auto_done") return "success";
  if (outcome === "approved") return "accent";
  if (outcome === "edited") return "warning";
  return "danger";
};

/** Short local date and time for a timestamp (Vietnam time). */
export const formatDateTime = (iso: string, intlTag: string): string =>
  new Intl.DateTimeFormat(intlTag, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));

/**
 * Read the owner's written basis out of a decision note (the localized "Basis: …" prefix written by decideWorkItem when
 * a payment is verified). Other notes are returned unchanged as `rest`.
 */
export const splitBasis = (note: string | null): { basis: string | null; rest: string | null } => {
  if (!note) return { basis: null, rest: null };
  const m = /^(?:Căn cứ|Basis):\s*([\s\S]+)$/.exec(note.trim()); // vn-ok: matches the stored vi prefix of the basis note
  return m ? { basis: m[1].trim(), rest: null } : { basis: null, rest: note };
};
