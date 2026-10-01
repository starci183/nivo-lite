/** Cutting a source into passages: pure, no I/O. About 800 characters per passage with a short overlap. */
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;

const clean = (text: string): string => text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** Split an over-long block at sentence ends, then at spaces, so no piece is longer than `max`. */
const splitLong = (block: string, max: number): Array<string> => {
  if (block.length <= max) return [block];
  const out: Array<string> = [];
  let rest = block;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"), window.lastIndexOf("; "), window.lastIndexOf("! "), window.lastIndexOf("? "));
    if (cut < max * 0.4) cut = window.lastIndexOf(" ");
    if (cut < max * 0.4) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
};

/**
 * Paragraphs (blank-line separated; a FAQ pair stays together) are packed into passages of up to `size` characters.
 * Each passage after the first starts with the tail of the previous one (`overlap` characters, from a word boundary).
 */
export const chunkText = (text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): Array<string> => {
  const body = clean(text);
  if (!body) return [];
  const blocks = body.split(/\n{2,}/).flatMap((b) => splitLong(b.trim(), size)).filter(Boolean);
  const packed: Array<string> = [];
  let cur = "";
  for (const b of blocks) {
    if (cur && cur.length + 2 + b.length > size) {
      packed.push(cur);
      cur = b;
    } else {
      cur = cur ? `${cur}\n\n${b}` : b;
    }
  }
  if (cur) packed.push(cur);
  if (overlap <= 0 || packed.length < 2) return packed;
  return packed.map((p, i) => {
    if (i === 0) return p;
    const prev = packed[i - 1] ?? "";
    let tail = prev.slice(-overlap);
    const space = tail.indexOf(" ");
    if (space > 0 && space < tail.length - 10) tail = tail.slice(space + 1);
    return `${tail.trim()}\n${p}`;
  });
};

/** FAQ pairs as text: "Hỏi: ...\nĐáp: ..." separated by a blank line, so each pair stays in one passage. */
export const faqToText = (pairs: ReadonlyArray<{ q: string; a: string }>, locale: "vi" | "en" = "vi"): string => {
  const [q, a] = locale === "vi" ? ["Hỏi", "Đáp"] : ["Q", "A"];
  return pairs.filter((p) => p.q.trim() && p.a.trim()).map((p) => `${q}: ${p.q.trim()}\n${a}: ${p.a.trim()}`).join("\n\n");
};
