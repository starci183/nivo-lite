// GENERATED from src/lib/knowledge/chunk.ts by engine/dev/sync-shared.mjs. Do not edit here: edit the web file and re-run the script.
/**
 * Cutting a source into passages: pure, no I/O. About 800 characters per passage with a short overlap.
 * Built for messy input: any text is accepted. Whitespace and invisible characters are normalised (and Vietnamese composed to NFC, so
 * "ế" typed two ways is one thing), very long lines are cut at the best boundary, tables / CSV are cut by row with their header repeated in
 * every passage, and exact duplicates (a footer printed on every page, the same paragraph pasted twice) are dropped.
 */
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;

/** Same text, tidy: NFC, one newline style, no control or zero-width characters, spaces collapsed, runs of dots / dashes shortened, at most one blank line in a row. */
export const normalizeText = (text: string): string =>
  text
    .normalize("NFC")
    .replace(/\r\n?|\u2028|\u2029/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/([.\-_=*~·•])\1{4,}/g, "$1$1$1")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** What makes two pieces "the same" for de-duplication: case, accents and punctuation ignored. */
const sameKey = (t: string): string =>
  t.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Never cut between the two halves of a surrogate pair. */
const safeCut = (s: string, at: number): number => {
  const c = s.charCodeAt(at - 1);
  return c >= 0xd800 && c <= 0xdbff ? at - 1 : at;
};

/** Split an over-long block at sentence ends, then at spaces, then anywhere, so no piece is longer than `max`. */
const splitLong = (block: string, max: number): Array<string> => {
  if (block.length <= max) return [block];
  const out: Array<string> = [];
  let rest = block;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"), window.lastIndexOf("; "), window.lastIndexOf("! "), window.lastIndexOf("? "));
    if (cut < max * 0.4) cut = window.lastIndexOf(" ");
    cut = cut < max * 0.4 ? safeCut(rest, max) : cut + 1;
    const piece = rest.slice(0, cut).trim();
    if (piece) out.push(piece);
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
};

/** The delimiter of a block that looks like a table / CSV (most lines carry the same number of it), or null. */
const delimiterOf = (lines: ReadonlyArray<string>): string | null => {
  if (lines.length < 3) return null;
  for (const d of ["\t", "|", ";", ","]) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const freq = new Map<number, number>();
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
    let mode = 0;
    let best = 0;
    for (const [c, n] of freq) if (n > best || (n === best && c > mode)) { mode = c; best = n; }
    if (mode >= (d === "," ? 2 : 1) && best / lines.length >= 0.7) return d;
  }
  return null;
};

type Piece = { readonly text: string; readonly table: boolean };

/** A table by rows: each piece is the header plus as many rows as fit. Duplicate rows are dropped. */
const tablePieces = (lines: ReadonlyArray<string>, size: number): Array<Piece> => {
  const rows = lines.filter((l) => l.trim() && !/^[\s|:+-]+$/.test(l));
  if (rows.length === 0) return [];
  const header = (rows[0] as string).length <= size / 2 ? (rows[0] as string) : "";
  const body = header ? rows.slice(1) : rows;
  const room = Math.max(120, size - header.length - 1);
  const out: Array<Piece> = [];
  const seen = new Set<string>();
  let cur: Array<string> = [];
  let len = 0;
  const flush = () => {
    if (cur.length) out.push({ text: (header ? [header, ...cur] : cur).join("\n"), table: true });
    cur = [];
    len = 0;
  };
  for (const row of body) {
    const key = sameKey(row);
    if (key && seen.has(key)) continue;
    seen.add(key);
    for (const part of splitLong(row, room)) {
      if (len && len + 1 + part.length > room) flush();
      cur.push(part);
      len += part.length + 1;
    }
  }
  flush();
  return out.length ? out : header ? [{ text: header, table: true }] : [];
};

/**
 * Paragraphs (blank-line separated; a FAQ pair stays together) are packed into passages of up to `size` characters.
 * Each prose passage after the first starts with the tail of the previous one (`overlap` characters, from a word boundary).
 * Tables / CSV are cut by row, each passage carrying the header. Identical passages and repeated long paragraphs are kept once.
 */
export const chunkText = (text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): Array<string> => {
  const body = normalizeText(text);
  if (!body) return [];
  const seenBlocks = new Set<string>();
  const pieces: Array<Piece> = [];
  for (const raw of body.split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split("\n");
    if (delimiterOf(lines)) {
      pieces.push(...tablePieces(lines, size));
      continue;
    }
    // Boilerplate (a footer repeated on every page) is long enough to recognise; short repeats ("Có", "Liên hệ") are kept.
    const key = sameKey(block);
    if (block.length >= 30 && key) {
      if (seenBlocks.has(key)) continue;
      seenBlocks.add(key);
    }
    for (const part of splitLong(block, size)) pieces.push({ text: part, table: false });
  }

  const packed: Array<Piece> = [];
  let cur = "";
  const flush = () => {
    if (cur) packed.push({ text: cur, table: false });
    cur = "";
  };
  for (const p of pieces) {
    if (p.table) {
      flush();
      packed.push(p);
    } else if (cur && cur.length + 2 + p.text.length > size) {
      flush();
      cur = p.text;
    } else {
      cur = cur ? `${cur}\n\n${p.text}` : p.text;
    }
  }
  flush();

  const seen = new Set<string>();
  const unique = packed.filter((p) => {
    const key = sameKey(p.text) || p.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (overlap <= 0 || unique.length < 2) return unique.map((p) => p.text);
  return unique.map((p, i) => {
    const prev = unique[i - 1];
    if (i === 0 || p.table || !prev || prev.table) return p.text;
    let tail = prev.text.slice(-overlap);
    const space = tail.indexOf(" ");
    if (space > 0 && space < tail.length - 10) tail = tail.slice(space + 1);
    return `${tail.trim()}\n${p.text}`;
  });
};

/** FAQ pairs as text: "Hỏi: ...\nĐáp: ..." separated by a blank line, so each pair stays in one passage. */
export const faqToText = (pairs: ReadonlyArray<{ q: string; a: string }>, locale: "vi" | "en" = "vi"): string => {
  const [q, a] = locale === "vi" ? ["Hỏi", "Đáp"] : ["Q", "A"];
  return pairs.filter((p) => p.q.trim() && p.a.trim()).map((p) => `${q}: ${p.q.trim()}\n${a}: ${p.a.trim()}`).join("\n\n");
};
