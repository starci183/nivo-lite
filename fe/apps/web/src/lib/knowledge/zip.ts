// Browser-side ZIP expansion for the Add documents drawer. Pure (no server-only, no DOM beyond Blob/File), so it can be checked with node.
import { unzipSync } from "fflate"

export const MAX_ZIP_BYTES = 200_000_000
export const MAX_ZIP_ENTRY_BYTES = 10_000_000
export const MAX_ZIP_TOTAL_BYTES = 500_000_000
/** Declared uncompressed size over compressed size above which the archive is refused (zip bomb). Entries under ZIP_RATIO_FLOOR are exempt: a 1 KB run of spaces legitimately compresses 100x. */
export const MAX_ZIP_RATIO = 100
export const ZIP_RATIO_FLOOR = 1_000_000

export type ZipError = "errTooBig" | "errNestedZip" | "errZipBad" | "errZipTooBig" | "errZipTotal" | "errZipBomb"

export type ZipRow = {
  /** Path inside the archive (decoded, "/" separated). */
  readonly path: string
  /** Folders above the file, " / " separated ("" at the root). */
  readonly dir: string
  /** Top-level folder below the archive's root folder, number prefix stripped. */
  readonly topic?: string
  /** Declared uncompressed size. */
  readonly size: number
  readonly error?: ZipError
  /** Present only for supported entries that were inflated. */
  readonly file?: File
}

export type ZipResult = {
  readonly rows: ReadonlyArray<ZipRow>
  /** More supported-looking entries than `maxEntries`: the rest were not listed. */
  readonly truncated: boolean
  /** Entries left out because they are not readable documents (images, videos, .DS_Store...): shown as one summary line, never as rows. */
  readonly skipped: number
  /** The whole archive was refused (nothing inflated). */
  readonly abort?: ZipError
}

const MIME: Record<string, string> = {
  txt: "text/plain", md: "text/markdown", markdown: "text/markdown", csv: "text/csv",
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
const SUPPORTED = /\.(txt|md|markdown|csv|pdf|docx|xlsx|pptx)$/i
const extOf = (name: string): string => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ""

/** MIME from the extension: a File built from zip bytes has no type. "" = unsupported. */
export const mimeFromName = (name: string): string => MIME[extOf(name)] ?? ""
export const isZipName = (name: string): boolean => extOf(name) === "zip"

/** Directories, macOS resource forks, dotfiles (any path segment) and Thumbs.db are not documents. */
export const isJunkEntry = (path: string): boolean => {
  if (path.endsWith("/") || path.endsWith("\\")) return true
  const parts = path.split(/[\\/]/)
  if (parts[0] === "__MACOSX") return true
  return parts.some((p) => p.startsWith(".")) || /^thumbs\.db$/i.test(parts[parts.length - 1] ?? "")
}

const CP437 = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "

/**
 * fflate decodes names with the UTF-8 flag as UTF-8 and the others as latin1. For the others recover the raw bytes and try strict UTF-8
 * (zips from macOS/Linux tools often omit the flag), then fall back to CP437, the zip default.
 */
export const decodeEntryName = (fflateName: string, utf8Flag: boolean): string => {
  if (utf8Flag) return fflateName
  let hasHigh = false
  const bytes = new Uint8Array(fflateName.length)
  for (let i = 0; i < fflateName.length; i++) {
    const c = fflateName.charCodeAt(i)
    if (c > 0xff) return fflateName
    if (c >= 0x80) hasHigh = true
    bytes[i] = c
  }
  if (!hasHigh) return fflateName
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes) } catch { /* not UTF-8 */ }
  let out = ""
  for (const b of bytes) out += b < 0x80 ? String.fromCharCode(b) : CP437[b - 0x80]
  return out
}

/** General-purpose bit flag of every central-directory record, in order; null when the directory cannot be walked (the names then stay as fflate decoded them). */
const centralFlags = (d: Uint8Array): Array<number> | null => {
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength)
  let e = d.length - 22
  const stop = Math.max(0, d.length - 22 - 65535)
  while (e >= stop && v.getUint32(e, true) !== 0x06054b50) e--
  if (e < stop) return null
  const count = v.getUint16(e + 10, true)
  let p = v.getUint32(e + 16, true)
  if (count === 0xffff || p === 0xffffffff) return null
  const out: Array<number> = []
  for (let i = 0; i < count; i++) {
    if (p + 46 > d.length || v.getUint32(p, true) !== 0x02014b50) return null
    out.push(v.getUint16(p + 8, true))
    p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
  }
  return out
}

type Planned = { readonly index: number; readonly raw: string; readonly path: string; readonly dir: string; readonly topic?: string; readonly size: number; readonly error?: ZipError }
type Plan = { readonly planned: ReadonlyArray<Planned>; readonly skipped: number; readonly truncated: boolean; readonly abort?: ZipError }

/** "1. THIẾT KẾ CHIẾN LƯỢC" -> "THIẾT KẾ CHIẾN LƯỢC" (Drive folders are numbered to sort them). */
export const topicFromFolder = (name: string): string => name.replace(/^\s*\d+\s*[.)\-–:]\s*/, "").trim().slice(0, 80)

/** Pass 1: judge every entry from the central directory's declared sizes. Nothing is inflated (the filter always answers false). */
export const planZip = (data: Uint8Array, maxEntries: number): Plan => {
  const flags = centralFlags(data)
  type Seen = { index: number; raw: string; path: string; size: number; compressed: number }
  const seen: Array<Seen> = []
  let index = -1
  let total = 0
  let abort: ZipError | undefined
  unzipSync(data, {
    filter: (f) => {
      index++
      const path = decodeEntryName(f.name, flags ? ((flags[index] ?? 0) & 0x800) !== 0 : true)
      if (path.endsWith("/") || path.endsWith("\\")) return false
      total += f.originalSize
      if (!abort && total > MAX_ZIP_TOTAL_BYTES) abort = "errZipTotal"
      seen.push({ index, raw: f.name, path: path.replace(/\\/g, "/"), size: f.originalSize, compressed: f.size })
      return false
    },
  })
  // Drive wraps a folder download in one root folder: it is not a topic, so topics are read below it.
  const kept = seen.filter((x) => !isJunkEntry(x.path))
  const root = kept.length > 0 && kept.every((x) => x.path.includes("/")) && new Set(kept.map((x) => x.path.split("/")[0])).size === 1 ? 1 : 0
  const planned: Array<Planned> = []
  let skipped = seen.length - kept.length
  let truncated = false
  for (const x of kept) {
    const nested = isZipName(x.path)
    if (!nested && !SUPPORTED.test(x.path)) { skipped++; continue }
    if (!abort && !nested && x.size >= ZIP_RATIO_FLOOR && x.size > MAX_ZIP_RATIO * Math.max(1, x.compressed)) abort = "errZipBomb"
    if (planned.length >= maxEntries) { truncated = true; continue }
    const segs = x.path.split("/")
    const below = segs.slice(root, -1)
    const error: ZipError | undefined = nested ? "errNestedZip" : x.size > MAX_ZIP_ENTRY_BYTES ? "errTooBig" : undefined
    planned.push({ index: x.index, raw: x.raw, path: x.path, dir: segs.slice(0, -1).join(" / "), ...(below[0] && topicFromFolder(below[0]) ? { topic: topicFromFolder(below[0]) } : {}), size: x.size, ...(error ? { error } : {}) })
  }
  return { planned, skipped, truncated, ...(abort ? { abort } : {}) }
}

/**
 * Open a zip: refuse it by declared sizes first, then inflate only the supported entries, each into its own File (name = last path segment, type from the extension).
 * Entries are inflated one at a time, so memory is bounded by the accepted entries (<= 10 MB each, <= 500 MB declared in total).
 */
export const readZip = async (zip: Blob, maxEntries: number): Promise<ZipResult> => {
  if (zip.size > MAX_ZIP_BYTES) return { rows: [], truncated: false, skipped: 0, abort: "errZipTooBig" }
  const data = new Uint8Array(await zip.arrayBuffer())
  let plan: ReturnType<typeof planZip>
  try { plan = planZip(data, maxEntries) } catch { return { rows: [], truncated: false, skipped: 0, abort: "errZipBad" } }
  if (plan.abort) return { rows: [], truncated: false, skipped: 0, abort: plan.abort }
  const rows: Array<ZipRow> = []
  for (const p of plan.planned) {
    const at = { path: p.path, dir: p.dir, ...(p.topic ? { topic: p.topic } : {}) }
    if (p.error) { rows.push({ ...at, size: p.size, error: p.error }); continue }
    try {
      let want = -1
      // Re-walk the directory (cheap) but inflate only this entry: one buffer alive at a time before it is copied into the File.
      const out = unzipSync(data, { filter: () => { want++; return want === p.index } })
      const bytes = out[p.raw]
      if (!bytes) { rows.push({ ...at, size: p.size, error: "errZipBad" }); continue }
      if (bytes.length > MAX_ZIP_ENTRY_BYTES) { rows.push({ ...at, size: bytes.length, error: "errTooBig" }); continue }
      const base = p.path.split(/[\\/]/).pop() ?? p.path
      rows.push({ ...at, size: bytes.length, file: new File([bytes as BlobPart], base, { type: mimeFromName(base) }) })
    } catch {
      rows.push({ ...at, size: p.size, error: "errZipBad" })
    }
  }
  return { rows, truncated: plan.truncated, skipped: plan.skipped }
}
