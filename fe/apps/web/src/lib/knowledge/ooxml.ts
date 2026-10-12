// Plain text out of .xlsx and .pptx (OOXML = zip of XML), read with fflate. Pure (no server-only) so it can be checked with node.
import { strFromU8, unzipSync } from "fflate"

export const XLSX_MAX_ROWS = 2000
const MAX_PART_BYTES = 60_000_000

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[e.toLowerCase()] ?? ""
  })

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`(?:^|[\\s:])${name}="([^"]*)"`).exec(tag)
  return m ? decodeEntities(m[1] ?? "") : null
}

/** Open the zip and inflate only the parts `want` accepts (and no part over 60 MB). */
const parts = (bytes: Uint8Array, want: (name: string) => boolean): Record<string, string> => {
  const out = unzipSync(bytes, { filter: (f) => want(f.name) && f.originalSize <= MAX_PART_BYTES })
  const text: Record<string, string> = {}
  for (const [k, v] of Object.entries(out)) text[k] = strFromU8(v)
  return text
}

const textRuns = (xml: string, tag: string): string => {
  let s = ""
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g")
  for (let m = re.exec(xml); m; m = re.exec(xml)) s += decodeEntities(m[1] ?? "")
  return s
}

const colIndex = (ref: string): number => {
  let n = 0
  for (const ch of /^[A-Z]+/i.exec(ref)?.[0] ?? "") n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64)
  return n - 1
}

const relTargets = (xml: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id"), target = attr(m[0], "Target")
    if (id && target) out[id] = target
  }
  return out
}

/** Each sheet as a text table (cells joined by " | "), empty rows skipped, at most XLSX_MAX_ROWS rows per sheet. */
export const xlsxToText = (bytes: Uint8Array): string => {
  const p = parts(bytes, (n) => n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || n === "xl/sharedStrings.xml" || /^xl\/worksheets\/[^/]+\.xml$/.test(n))
  const book = p["xl/workbook.xml"]
  if (!book) throw new Error("not an xlsx")
  const rels = relTargets(p["xl/_rels/workbook.xml.rels"] ?? "")
  const shared: Array<string> = []
  for (const m of (p["xl/sharedStrings.xml"] ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(textRuns((m[1] ?? "").replace(/<rPh\b[\s\S]*?<\/rPh>/g, ""), "t"))
  const blocks: Array<string> = []
  let n = 0
  for (const m of book.matchAll(/<sheet\b[^>]*>/g)) {
    n++
    const name = attr(m[0], "name") ?? `Sheet ${n}`
    const rid = attr(m[0], "id")
    const target = rid ? rels[rid] : undefined
    const path = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : `xl/worksheets/sheet${n}.xml`
    const xml = p[path]
    if (!xml) continue
    const lines: Array<string> = []
    for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      if (lines.length >= XLSX_MAX_ROWS) break
      const cells: Array<string> = []
      let auto = 0
      for (const c of (r[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1] ?? "", "r")
        const at = ref ? colIndex(ref) : auto
        auto = at + 1
        const t = attr(c[1] ?? "", "t")
        const body = c[2] ?? ""
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        let val = ""
        if (t === "s") val = shared[Number(v)] ?? ""
        else if (t === "inlineStr") val = textRuns(body, "t")
        else if (t === "b") val = v === "1" ? "TRUE" : v === "0" ? "FALSE" : ""
        else if (v !== undefined) val = decodeEntities(v)
        while (cells.length < at) cells.push("")
        cells[at] = val.replace(/\s+/g, " ").trim()
      }
      while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop()
      if (cells.length > 0 && cells.some((x) => x !== "")) lines.push(cells.join(" | "))
    }
    if (lines.length > 0) blocks.push(`## ${name}\n${lines.join("\n")}`)
  }
  return blocks.join("\n\n")
}

const paragraphs = (xml: string): string =>
  [...xml.replace(/<a:fld\b[^>]*type="slidenum"[\s\S]*?<\/a:fld>/g, "").matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
    .map((m) => textRuns((m[1] ?? "").replace(/<a:br\s*\/>/g, "<a:t>\n</a:t>"), "a:t").trim())
    .filter(Boolean)
    .join("\n")

/** Slides in order: "## Slide N" then the text of every shape; speaker notes follow as "Ghi chú:". */
export const pptxToText = (bytes: Uint8Array): string => {
  const p = parts(bytes, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n) || /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(n) || /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n))
  const slides = Object.keys(p).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]))
  if (slides.length === 0) throw new Error("not a pptx")
  const blocks: Array<string> = []
  slides.forEach((path, i) => {
    const body = paragraphs(p[path] ?? "")
    const rel = p[path.replace("slides/", "slides/_rels/") + ".rels"] ?? ""
    const note = Object.values(relTargets(rel)).find((t) => t.includes("notesSlides/"))
    const notes = note ? paragraphs(p[`ppt/notesSlides/${note.split("/").pop()}`] ?? "") : ""
    const pieces = [`## Slide ${i + 1}`, body, notes ? `Ghi chú:\n${notes}` : ""].filter(Boolean)
    if (pieces.length > 1) blocks.push(pieces.join("\n"))
  })
  return blocks.join("\n\n")
}
