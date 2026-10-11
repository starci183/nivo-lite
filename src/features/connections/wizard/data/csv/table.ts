import "server-only"
import Papa from "papaparse"
import readXlsxFile from "read-excel-file/universal"
import type { RecordInput } from "@/lib/data-hub"
import { MAX_COLUMNS, MAX_FILE_BYTES, MAX_ROWS, NO_COLUMN, type ColumnKind, type CsvConfig, type CsvEntity, type CsvMapping } from "./types"
import { fold, normalisePhone, parseDateLoose, parseNumberLoose } from "./values"

/** A user-facing failure (plain Vietnamese). Anything else is logged and shown as a generic error. */
export class CsvError extends Error {}

export type Table = {
  readonly headers: string[]
  readonly rows: string[][]
  readonly delimiter: string
  readonly sheets: string[]
  readonly sheet: string
}

const CELL_MAX = 5_000

/* ------------------------------------------------------------------ reading */

const dateCell = (d: Date): string => {
  const iso = d.toISOString()
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso
}

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return ""
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : dateCell(v)
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : ""
  return String(v).trim().slice(0, CELL_MAX)
}

/** Header row -> unique, non-empty names ("", "Tên", "Tên" -> "Cột 1", "Tên", "Tên (2)"). */
const cleanHeaders = (row: ReadonlyArray<string>): string[] => {
  const seen = new Map<string, number>()
  return row.map((h, i) => {
    const base = (h || `Cột ${i + 1}`).slice(0, 120)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

/** First non-empty row = headers; the rest = data rows (rows that are completely empty are dropped). */
export const tableFromRows = (raw: ReadonlyArray<ReadonlyArray<unknown>>, extra: Pick<Table, "delimiter" | "sheets" | "sheet">): Table => {
  const all = raw.map((r) => r.map(cell))
  const first = all.findIndex((r) => r.some(Boolean))
  if (first < 0) throw new CsvError("File không có dữ liệu.")
  let width = all[first].length
  while (width > 0 && !all[first][width - 1]) width--
  if (width === 0) throw new CsvError("Dòng đầu tiên phải là tên các cột.")
  if (width > MAX_COLUMNS) throw new CsvError(`File có quá nhiều cột (tối đa ${MAX_COLUMNS}).`)
  const headers = cleanHeaders(all[first].slice(0, width))
  const rows = all.slice(first + 1).filter((r) => r.some(Boolean)).map((r) => headers.map((_, i) => r[i] ?? ""))
  if (rows.length > MAX_ROWS) throw new CsvError(`File có hơn ${MAX_ROWS.toLocaleString("vi-VN")} dòng. Hãy chia nhỏ file rồi nhập từng phần.`)
  return { headers, rows, ...extra }
}

/** Decodes bytes as UTF-8 (BOM dropped) or UTF-16 when it carries a UTF-16 BOM. */
export const decodeText = (bytes: Uint8Array): string => {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2))
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "")
}

/** Delimited text (comma, semicolon, tab or pipe, detected) -> table. */
export const tableFromText = (text: string): Table => {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { delimitersToGuess: [",", ";", "\t", "|"], skipEmptyLines: "greedy" })
  const bad = parsed.errors.find((e) => e.type === "Quotes")
  if (bad && parsed.data.length === 0) throw new CsvError("Không đọc được dữ liệu: dấu ngoặc kép bị lệch.")
  return tableFromRows(parsed.data, { delimiter: parsed.meta.delimiter || ",", sheets: [], sheet: "" })
}

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04

export const fileKind = (name: string): "csv" | "xlsx" | null => {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return ext === "csv" || ext === "tsv" || ext === "txt" ? "csv" : ext === "xlsx" ? "xlsx" : null
}

export const assertSize = (bytes: Uint8Array) => {
  if (bytes.byteLength === 0) throw new CsvError("File trống.")
  if (bytes.byteLength > MAX_FILE_BYTES) throw new CsvError("File lớn hơn 10 MB.")
}

/** An uploaded .csv or .xlsx -> table (xlsx: the named sheet, else the first). */
export const tableFromFile = async (name: string, bytes: Uint8Array, sheet?: string): Promise<Table> => {
  assertSize(bytes)
  const kind = fileKind(name)
  if (!kind) throw new CsvError("Chỉ nhận file .csv hoặc .xlsx.")
  if (kind === "csv") {
    if (bytes.subarray(0, 4096).includes(0) && !(bytes[0] === 0xff || bytes[0] === 0xfe)) throw new CsvError("File này không phải văn bản CSV.")
    return tableFromText(decodeText(bytes))
  }
  if (!isZip(bytes)) throw new CsvError("File .xlsx không hợp lệ. File .xls cũ cần lưu lại thành .xlsx.")
  let sheets: Array<{ sheet: string; data: unknown[][] }>
  try {
    sheets = (await readXlsxFile(new Blob([new Uint8Array(bytes)]))) as unknown as Array<{ sheet: string; data: unknown[][] }>
  } catch {
    throw new CsvError("Không đọc được file Excel này.")
  }
  if (sheets.length === 0) throw new CsvError("File Excel không có trang tính nào.")
  const names = sheets.map((s) => s.sheet)
  const chosen = sheets.find((s) => s.sheet === sheet) ?? sheets[0]
  return tableFromRows(chosen.data, { delimiter: "", sheets: names, sheet: chosen.sheet })
}

/** Rows typed or pasted in the grid. */
export const tableFromGrid = (headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>): Table =>
  tableFromRows([headers, ...rows], { delimiter: "", sheets: [], sheet: "" })

/* ------------------------------------------------------------------ mapping */

const hasWord = (folded: string, words: ReadonlyArray<string>) => words.some((w) => ` ${folded} `.includes(` ${w} `))

const PHONE = ["sdt", "so dien thoai", "dien thoai", "phone", "mobile", "tel", "zalo", "hotline", "di dong"]
const EMAIL = ["email", "mail", "thu dien tu"]
const NAME = ["ho ten", "ho va ten", "ten khach hang", "ten khach", "khach hang", "ten", "name", "full name", "customer", "customer name", "fullname"]
const CODE = ["ma", "id", "code", "sku", "ma so", "stt", "barcode", "mst", "cccd", "ma khach hang", "ma kh", "ma don", "ma don hang", "ma san pham", "order id", "ma giao dich"]
const DATE = ["ngay", "date", "thoi gian", "time", "created", "ngay tao", "ngay sinh", "created at"]
const PRODUCT_NAME = ["ten san pham", "ten hang", "san pham", "product", "product name", "ten hang hoa", "ten"]
const ORDER_TITLE = ["ma don", "ma don hang", "order", "order id", "ten khach hang", "khach hang"]

const find = (headers: ReadonlyArray<string>, words: ReadonlyArray<string>, exact = false): string | null => {
  for (const w of words) {
    const h = headers.find((x) => (exact ? fold(x) === w : hasWord(fold(x), [w])))
    if (h) return h
  }
  return null
}

const detectKind = (header: string, values: ReadonlyArray<string>): ColumnKind => {
  const f = fold(header)
  if (hasWord(f, PHONE)) return "phone"
  if (hasWord(f, EMAIL)) return "email"
  const filled = values.filter(Boolean).slice(0, 200)
  if (filled.length === 0) return "text"
  const isCode = hasWord(f, CODE) || (/^(ma|so)\b/.test(f) && !/(luong|tien|gia)/.test(f))
  const dates = filled.filter((v) => parseDateLoose(v) !== null).length
  if (dates / filled.length >= 0.8) return "date"
  if (hasWord(f, DATE) && dates / filled.length >= 0.5) return "date"
  if (!isCode) {
    const nums = filled.filter((v) => parseNumberLoose(v) !== null && !/^0\d/.test(v.trim())).length
    if (nums === filled.length) return "number"
  }
  return "text"
}

/** A first guess at which columns are the id, the title and the date, and how each column should be read. */
export const suggestMapping = (table: Pick<Table, "headers" | "rows">, entity: CsvEntity): CsvMapping => {
  const { headers, rows } = table
  const kinds: Record<string, ColumnKind> = {}
  headers.forEach((h, i) => { kinds[h] = detectKind(h, rows.slice(0, 200).map((r) => r[i])) })
  const phone = headers.find((h) => kinds[h] === "phone") ?? null
  const email = headers.find((h) => kinds[h] === "email") ?? null
  const code = find(headers, CODE, true) ?? headers.find((h) => /^(ma|id|sku)\b/.test(fold(h))) ?? null
  const idColumn = entity === "customer" ? (code ?? email ?? phone) : code
  const titleColumn =
    (entity === "product" ? find(headers, PRODUCT_NAME) : entity === "order" ? find(headers, ORDER_TITLE) : find(headers, NAME)) ??
    headers.find((h) => kinds[h] === "text" && h !== idColumn) ?? headers[0] ?? null
  const dateColumn = find(headers.filter((h) => kinds[h] === "date"), DATE) ?? headers.find((h) => kinds[h] === "date") ?? null
  return { idColumn, titleColumn, dateColumn, kinds, columns: headers }
}

/** Which mapped columns (id, title, date) the new headers no longer carry. */
export const missingColumns = (config: Pick<CsvConfig, "idColumn" | "titleColumn" | "dateColumn">, headers: ReadonlyArray<string>): string[] =>
  [config.idColumn, config.titleColumn, config.dateColumn].filter((c): c is string => Boolean(c) && !headers.includes(c as string))

/* ------------------------------------------------------------------ rows -> hub records */

export type BuiltRecords = { records: RecordInput[]; skipped: number; duplicates: number }

const KINDS: ReadonlyArray<ColumnKind> = ["text", "phone", "email", "number", "date"]

/** Checks a mapping that came from the browser: every name must be a real header, every kind a known one. */
export const cleanMapping = (raw: unknown, headers: ReadonlyArray<string>): CsvMapping => {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const pick = (v: unknown): string | null => {
    if (v === null || v === undefined || v === NO_COLUMN || v === "") return null
    if (typeof v !== "string" || !headers.includes(v)) throw new CsvError(`Cột "${String(v).slice(0, 60)}" không có trong dữ liệu.`)
    return v
  }
  const kindsIn = (o.kinds && typeof o.kinds === "object" ? o.kinds : {}) as Record<string, unknown>
  const kinds: Record<string, ColumnKind> = {}
  for (const h of headers) {
    const k = kindsIn[h]
    kinds[h] = KINDS.includes(k as ColumnKind) ? (k as ColumnKind) : "text"
  }
  return { idColumn: pick(o.idColumn), titleColumn: pick(o.titleColumn), dateColumn: pick(o.dateColumn), kinds, columns: [...headers] }
}

/** Rows -> hub records: trimmed text, phones as digit text, parsed numbers and dates in separate fields, original text kept. */
export const buildRecords = (table: Pick<Table, "headers" | "rows">, mapping: CsvMapping): BuiltRecords => {
  const { headers, rows } = table
  const col = (name: string | null) => (name ? headers.indexOf(name) : -1)
  const idI = col(mapping.idColumn)
  const titleI = col(mapping.titleColumn)
  const dateI = col(mapping.dateColumn)
  const byId = new Map<string, RecordInput>()
  let skipped = 0
  let duplicates = 0
  rows.forEach((row, n) => {
    const data: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      const raw = (row[i] ?? "").trim()
      if (raw === "") return
      const kind = mapping.kinds[h] ?? "text"
      if (kind === "phone") {
        const p = normalisePhone(raw)
        data[h] = p || raw
        if (p && p !== raw) data[`${h}__raw`] = raw
      } else if (kind === "email") data[h] = raw.toLowerCase()
      else {
        data[h] = raw
        if (kind === "number") { const v = parseNumberLoose(raw); if (v !== null) data[`${h}__number`] = v }
        if (kind === "date") { const v = parseDateLoose(raw); if (v) data[`${h}__date`] = v }
      }
    })
    if (Object.keys(data).length === 0) return
    const lineNo = n + 1
    let externalId: string
    if (idI >= 0) {
      const v = (row[idI] ?? "").trim()
      if (!v || v.length > 300) { skipped++; return }
      externalId = mapping.kinds[mapping.idColumn as string] === "phone" ? normalisePhone(v) || v : v
    } else externalId = `row-${lineNo}`
    const title = (titleI >= 0 ? (row[titleI] ?? "").trim() : "") || (idI >= 0 ? externalId : `Dòng ${lineNo}`)
    const when = dateI >= 0 ? parseDateLoose((row[dateI] ?? "").trim()) : null
    if (byId.has(externalId)) duplicates++
    byId.set(externalId, { externalId, title: title.slice(0, 300), occurredAt: when, data })
  })
  return { records: [...byId.values()], skipped, duplicates }
}
