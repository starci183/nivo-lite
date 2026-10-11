import type { GuidePage } from "./sitemap";

/** Lower-case, accents removed (đ -> d), punctuation to spaces: "Báo tiền về?" -> "bao tien ve". */
export const normalize = (s: string): string =>
  s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9@.]+/g, " ").trim();

const scoreOf = (question: string, page: GuidePage): number => {
  const whole = normalize(question);
  const q = ` ${whole} `;
  let score = 0;
  for (const k of page.keywords) {
    const key = normalize(k);
    if (key && q.includes(` ${key} `)) score += key.split(" ").length + 1; // a longer phrase is stronger evidence
    if (key && whole === key) score += 2; // the question is exactly this name ("SePay", "Zalo OA")
  }
  return score;
};

/**
 * The one page a question clearly asks about, or null when it is unclear (then the model answers). Clear means a score of at least 3
 * (a two-word phrase, or two single words) and at least 1.5 times the runner-up, so "kết nối" alone does not pick one provider.
 */
export const matchPage = (question: string, pages: ReadonlyArray<GuidePage>): GuidePage | null => {
  const ranked = pages.map((p) => ({ p, s: scoreOf(question, p) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
  const [best, next] = ranked;
  if (!best || best.s < 3) return null;
  if (next && best.s < next.s * 1.5) return null;
  return best.p;
};
