/** Pure value helpers for the csv_import connector (no I/O): accents, phones, numbers, dates. */

/** Lower-case, accent-free text for matching headers: "Số điện thoại" -> "so dien thoai". */
export const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/** Digits only, the Vietnamese way: "+84 912 345 678" and "912345678" both become "0912345678". Keeps text, never a number. */
export const normalisePhone = (raw: string): string => {
  let d = raw.replace(/\D+/g, "")
  if (!d) return ""
  if (d.startsWith("84") && d.length >= 11) d = `0${d.slice(2)}`
  else if (d.length === 9 && !d.startsWith("0")) d = `0${d}`
  return d
}

/** "1.200.000" -> 1200000, "1,200,000" -> 1200000, "1.234,56" -> 1234.56, "12.5" -> 12.5, "(300)" -> -300. Null when not a number. */
export const parseNumberLoose = (raw: string): number | null => {
  let s = raw.trim().replace(/\s+/g, "").replace(/(vnđ|vnd|đ|₫|\$|usd|%)/gi, "")
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1) }
  else if (s.startsWith("+")) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null
  const dots = (s.match(/\./g) ?? []).length
  const commas = (s.match(/,/g) ?? []).length
  let out: string
  if (dots && commas) {
    const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ","
    const thousand = decimal === "." ? "," : "."
    out = s.split(thousand).join("").replace(decimal, ".")
  } else if (dots > 1 || commas > 1) {
    out = s.replace(/[.,]/g, "")
  } else if (dots || commas) {
    const sep = dots ? "." : ","
    const [head, tail] = s.split(sep)
    const thousands = tail.length === 3 && head.length >= 1 && head.length <= 3 && head !== "0"
    out = thousands ? `${head}${tail}` : `${head}.${tail}`
  } else out = s
  if (!/^\d+(\.\d+)?$/.test(out)) return null
  const n = Number(out)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

const pad = (n: number) => String(n).padStart(2, "0")

/** A date from the common Vietnamese and ISO spellings, as an ISO instant (date-only values are midnight in Vietnam, +07:00). */
export const parseDateLoose = (raw: string): string | null => {
  const s = raw.trim()
  if (!s) return null
  let y: number, mo: number, d: number
  let rest = ""
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(.*))?$/)
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4] ?? "" }
  else {
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[T\s]+(.*))?$/)
    if (!m) return null
    d = +m[1]; mo = +m[2]; y = +m[3]; rest = m[4] ?? ""
    if (m[3].length === 2) y += y <= 69 ? 2000 : 1900
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null
  const probe = new Date(Date.UTC(y, mo - 1, d))
  if (probe.getUTCMonth() !== mo - 1) return null
  const date = `${y}-${pad(mo)}-${pad(d)}`
  if (!rest) return new Date(`${date}T00:00:00+07:00`).toISOString()
  const t = rest.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i)
  if (!t || +t[1] > 23 || +t[2] > 59) return null
  let zone = t[4] ?? "+07:00"
  if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`
  const iso = new Date(`${date}T${pad(+t[1])}:${t[2]}:${t[3] ?? "00"}${zone.toUpperCase()}`)
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString()
}
