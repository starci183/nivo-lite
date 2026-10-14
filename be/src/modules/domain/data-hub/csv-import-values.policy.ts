const char = (code: number): string => String.fromCodePoint(code)
const COMBINING_MARKS = new RegExp(`[${char(0x300)}-${char(0x36f)}]`, "gu")
const D_STROKE = new RegExp(`[${char(0x110)}${char(0x111)}]`, "gu")
const CURRENCY_MARKS = new RegExp(`(vn${char(0x111)}|vnd|${char(0x111)}|${char(0x20ab)}|\\$|usd|%)`, "giu")

/** Lower-case, accent-free text for matching headers, so a Vietnamese phone heading becomes "so dien thoai". */
export const fold = (text: string): string =>
    text
        .normalize("NFD")
        .replace(COMBINING_MARKS, "")
        .replace(D_STROKE, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, " ")
        .trim()

/** Digits only, the Vietnamese way: "+84 912 345 678" and "912345678" both become "0912345678". Keeps text, never a number. */
export const normalisePhone = (raw: string): string => {
    let digits = raw.replace(/\D+/gu, "")
    if (digits === "") return ""
    if (digits.startsWith("84") && digits.length >= 11) digits = `0${digits.slice(2)}`
    else if (digits.length === 9 && !digits.startsWith("0")) digits = `0${digits}`
    return digits
}

const count = (text: string, char: string): number => text.split(char).length - 1

/** "1.200.000" gives 1200000, "1,200,000" gives 1200000, "1.234,56" gives 1234.56, "12.5" gives 12.5, "(300)" gives -300. Null when it is not a number. */
export const parseNumberLoose = (raw: string): number | null => {
    let text = raw.trim().replace(/\s+/gu, "").replace(CURRENCY_MARKS, "")
    if (text === "") return null
    let negative = false
    if (/^\(.*\)$/u.test(text)) {
        negative = true
        text = text.slice(1, -1)
    }
    if (text.startsWith("-")) {
        negative = !negative
        text = text.slice(1)
    } else if (text.startsWith("+")) text = text.slice(1)
    if (!/^[\d.,]+$/u.test(text) || !/\d/u.test(text)) return null
    const dots = count(text, ".")
    const commas = count(text, ",")
    let out: string
    if (dots > 0 && commas > 0) {
        const decimal = text.lastIndexOf(".") > text.lastIndexOf(",") ? "." : ","
        const thousand = decimal === "." ? "," : "."
        out = text.split(thousand).join("").replace(decimal, ".")
    } else if (dots > 1 || commas > 1) {
        out = text.replace(/[.,]/gu, "")
    } else if (dots > 0 || commas > 0) {
        const separator = dots > 0 ? "." : ","
        const [head = "", tail = ""] = text.split(separator)
        const thousands = tail.length === 3 && head.length >= 1 && head.length <= 3 && head !== "0"
        out = thousands ? `${head}${tail}` : `${head}.${tail}`
    } else out = text
    if (!/^\d+(\.\d+)?$/u.test(out)) return null
    const value = Number(out)
    if (!Number.isFinite(value)) return null
    return negative ? -value : value
}

const pad = (value: number): string => String(value).padStart(2, "0")

interface DateParts {
    readonly year: number
    readonly month: number
    readonly day: number
    readonly rest: string
}

const fullYear = (text: string): number => {
    const year = Number(text)
    if (text.length !== 2) return year
    return year + (year <= 69 ? 2000 : 1900)
}

const datePartsOf = (text: string): DateParts | null => {
    const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(.*))?$/u.exec(text)
    if (iso !== null) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]), rest: iso[4] ?? "" }
    const local = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[T\s]+(.*))?$/u.exec(text)
    if (local === null) return null
    const year = fullYear(String(local[3]))
    return { year, month: Number(local[2]), day: Number(local[1]), rest: local[4] ?? "" }
}

/** A date from the common Vietnamese and ISO spellings, as an ISO instant (date-only values are midnight in Vietnam, +07:00). */
export const parseDateLoose = (raw: string): string | null => {
    const text = raw.trim()
    if (text === "") return null
    const parts = datePartsOf(text)
    if (parts === null) return null
    const { year, month, day, rest } = parts
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null
    if (new Date(Date.UTC(year, month - 1, day)).getUTCMonth() !== month - 1) return null
    const date = `${year}-${pad(month)}-${pad(day)}`
    if (rest === "") return new Date(`${date}T00:00:00+07:00`).toISOString()
    const time = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/iu.exec(rest)
    if (time === null || Number(time[1]) > 23 || Number(time[2]) > 59) return null
    let zone = time[4] ?? "+07:00"
    if (/^[+-]\d{4}$/u.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`
    const instant = new Date(`${date}T${pad(Number(time[1]))}:${time[2]}:${time[3] ?? "00"}${zone.toUpperCase()}`)
    return Number.isNaN(instant.getTime()) ? null : instant.toISOString()
}
