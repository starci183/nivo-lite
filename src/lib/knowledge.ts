/**
 * Reading the owner's business knowledge (the agent's "knowledge" text): pure, no I/O (checked by scripts/policy-check.mjs).
 * The chatbot may only take an order at a price the owner wrote down, and payment details come from the owner's own line.
 */

const NOT_LETTER = "(?![\\p{L}\\p{N}])";

/**
 * Every money amount written in the knowledge, in VND: "5.000.000đ", "5,000,000", "5000000", "5 triệu", "1,5tr", "500k",
 * "500 nghìn". Plain numbers below 1.000 are not amounts (session counts, years are harmless extra entries).
 */
export const pricesInKnowledge = (text: string | null | undefined): Array<number> => {
  const s = (text ?? "").normalize("NFC").toLowerCase();
  const out = new Set<number>();
  const num = (raw: string) => Number(raw.replace(",", "."));
  for (const m of s.matchAll(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:triệu|trieu|tr)${NOT_LETTER}`, "gu"))) {
    const v = Math.round(num(m[1]) * 1_000_000);
    if (Number.isFinite(v) && v > 0) out.add(v);
  }
  for (const m of s.matchAll(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:k|nghìn|ngàn|nghin|ngan)${NOT_LETTER}`, "gu"))) {
    const v = Math.round(num(m[1]) * 1_000);
    if (Number.isFinite(v) && v > 0) out.add(v);
  }
  for (const m of s.matchAll(/\d{1,3}(?:[.,]\d{3})+(?!\d)|\d{4,}/g)) {
    const v = Number(m[0].replace(/[.,]/g, ""));
    if (Number.isFinite(v) && v >= 1_000) out.add(v);
  }
  return [...out];
};

/** True when this exact amount is a price the owner wrote in the knowledge (the chatbot never invents a price). */
export const isKnownPrice = (knowledge: string | null | undefined, amount: number | null | undefined): boolean =>
  typeof amount === "number" && Number.isFinite(amount) && amount > 0 && pricesInKnowledge(knowledge).includes(Math.round(amount));

/** The owner's bank transfer details: the text after "Thông tin chuyển khoản:" (or "Bank transfer details:"), else null. */
export const transferDetails = (knowledge: string | null | undefined): string | null => {
  for (const line of (knowledge ?? "").normalize("NFC").split(/\r?\n/)) {
    const m = line.match(/^\s*[-*•]?\s*(?:thông tin chuyển khoản|bank transfer details|payment details)\s*[:：]\s*(.+?)\s*$/iu);
    if (m?.[1]) return m[1];
  }
  return null;
};
