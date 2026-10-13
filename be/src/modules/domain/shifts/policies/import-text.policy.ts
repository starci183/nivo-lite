/** One person typed in the quick import. */
export interface ParsedStaff {
    /** The name. */
    readonly name: string
    /** The position names, spelled as the shop spells them. */
    readonly positions: ReadonlyArray<string>
    /** The hourly wage in dong. */
    readonly wage: number
    /** The most hours a week, or null to keep the default. */
    readonly maxWeek: number | null
}

/** One coverage line typed in the quick import, for one weekday. */
export interface ParsedBlock {
    /** The weekday, 0 Monday to 6 Sunday. */
    readonly weekday: number
    /** The window start, HH:MM. */
    readonly start: string
    /** The window end, HH:MM. */
    readonly end: string
    /** The position name. */
    readonly position: string
    /** The fewest people. */
    readonly min: number
    /** The ideal people. */
    readonly ideal: number
    /** True for a peak window. */
    readonly peak: boolean
}

/** What was wrong with one line. */
export type ImportErrorCode =
    | "staff-format"
    | "staff-position-missing"
    | "staff-position-unknown"
    | "staff-wage"
    | "staff-hours"
    | "coverage-format"
    | "coverage-days"
    | "coverage-times"
    | "coverage-position"
    | "coverage-ideal"

/** One line that could not be read. */
export interface ImportError {
    /** What is wrong. */
    readonly code: ImportErrorCode
    /** The line number, from 1. */
    readonly line: number
    /** The person or position the message names; empty when none. */
    readonly subject: string
}

/** The text of the three quick import boxes. */
export interface ImportText {
    /** The positions, one per line or separated by commas. */
    readonly positions: string
    /** The people, one per line: name; positions; wage; hours per week. */
    readonly staff: string
    /** The coverage, one per line: days, hours, position, minimum-ideal, peak. */
    readonly coverage: string
}

/** The positions, people and coverage blocks the text describes, and the lines that could not be read. */
export interface ParsedImport {
    /** The new positions. */
    readonly positions: ReadonlyArray<string>
    /** The people. */
    readonly staff: ReadonlyArray<ParsedStaff>
    /** The coverage blocks, one per weekday. */
    readonly blocks: ReadonlyArray<ParsedBlock>
    /** The lines that could not be read. */
    readonly errors: ReadonlyArray<ImportError>
}

const LAST_WEEKDAY = 6

const WEEK_ALL: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6]

const DAY_TOKENS: Readonly<Record<string, number>> = { t2: 0, t3: 1, t4: 2, t5: 3, t6: 4, t7: 5, cn: 6 }

const EVERY_DAY: ReadonlyArray<string> = ["moingay", "hangngay", "t2-cn", "t2-t7-cn"]

const MAX_WEEK_HOURS = 100

const THOUSAND = 1000

const HOURS_PER_DAY = 24

const MINUTES_PER_HOUR = 60

/** Lower case, no accents, single spaces: how names and keywords are compared. */
export const fold = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\u0111/gu, "d")
        .replace(/\s+/gu, " ")
        .trim()

/** The weekdays a day expression names (T2, T2-T6, T2,T4, CN, every day), or null when it is not one. */
const parseDays = (raw: string): Array<number> | null => {
    const text = fold(raw).replace(/\s+/gu, "")
    if (EVERY_DAY.includes(text)) return [...WEEK_ALL]
    const days = new Set<number>()
    for (const part of text.split(",")) {
        const match = /^(t[2-7]|cn)(?:-(t[2-7]|cn))?$/u.exec(part)
        const from = DAY_TOKENS[match?.[1] ?? ""]
        const to = match?.[2] === undefined ? from : DAY_TOKENS[match[2]]
        if (from === undefined || to === undefined || to < from) return null
        for (let day = from; day <= to && day <= LAST_WEEKDAY; day++) days.add(day)
    }
    return days.size > 0 ? [...days].sort() : null
}

/** An HH:MM time from 7, 07:00, 7h or 7h30; null when it is not a time. */
const parseClock = (raw: string): string | null => {
    const match = /^(\d{1,2})(?:[:h](\d{2})?)?$/u.exec(raw.trim().toLowerCase())
    if (match === null) return null
    const hours = Number(match[1])
    const minutes = match[2] === undefined ? 0 : Number(match[2])
    if (hours >= HOURS_PER_DAY || minutes >= MINUTES_PER_HOUR) return null
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/** An hourly wage from 30k, 30000 or 30.000 (with an optional currency or per-hour suffix); null when unreadable. */
export const parseWage = (raw: string): number | null => {
    const text = raw.toLowerCase().replace(/\s|\u0111|vnd|\/h|\/gio/gu, "")
    const thousands = /^(\d+(?:[.,]\d+)?)k$/u.exec(text)
    if (thousands !== null) return Math.round(Number((thousands[1] ?? "0").replace(",", ".")) * THOUSAND)
    const value = Number(text.replace(/[.,](?=\d{3}\b)/gu, ""))
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
}

interface Known {
    readonly has: (name: string) => boolean
    readonly canon: (name: string) => string
}

const knownOf = (names: ReadonlyArray<string>): Known => ({
    has: (name) => names.some((known) => fold(known) === fold(name)),
    canon: (name) => names.find((known) => fold(known) === fold(name)) ?? name,
})

const parseStaffLine = (line: string, number: number, known: Known): ParsedStaff | ImportError => {
    const parts = line.split(/[;|\t]/u).map((x) => x.trim())
    const name = parts[0] ?? ""
    const failed = (code: ImportErrorCode, subject = name): ImportError => ({ code, line: number, subject })
    if (parts.length < 2 || name === "") return failed("staff-format", "")
    const positions = (parts[1] ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x !== "")
    const unknown = positions.filter((p) => !known.has(p))
    if (positions.length === 0) return failed("staff-position-missing")
    if (unknown.length > 0) return failed("staff-position-unknown", unknown.join(", "))
    const wage = parts[2] ? parseWage(parts[2]) : 0
    if (wage === null) return failed("staff-wage")
    const maxWeek = parts[3] ? Number(parts[3].replace(",", ".")) : null
    if (maxWeek !== null && (!Number.isFinite(maxWeek) || maxWeek <= 0 || maxWeek > MAX_WEEK_HOURS)) {
        return failed("staff-hours")
    }
    return { name, positions: positions.map(known.canon), wage, maxWeek }
}

const parseCoverageLine = (line: string, number: number, known: Known): Array<ParsedBlock> | ImportError => {
    const folded = fold(line)
    const peak = /(cao diem|peak)\s*$/u.test(folded)
    const body = folded.replace(/(cao diem|peak)\s*$/u, "").trim()
    const failed = (code: ImportErrorCode, subject = ""): ImportError => ({ code, line: number, subject })
    const match =
        /^(.+?)\s+(\d{1,2}(?:[:h]\d{2})?)\s*[-–]\s*(\d{1,2}(?:[:h]\d{2})?)\s+(.+?)\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/u.exec(
            body,
        )
    if (match === null) return failed("coverage-format")
    const days = parseDays(match[1] ?? "")
    const start = parseClock(match[2] ?? "")
    const end = parseClock(match[3] ?? "")
    const position = match[4] ?? ""
    const min = Number(match[5])
    const ideal = match[6] === undefined ? min : Number(match[6])
    if (days === null) return failed("coverage-days", match[1] ?? "")
    if (start === null || end === null || start >= end) return failed("coverage-times")
    if (!known.has(position)) return failed("coverage-position", position)
    if (ideal < min) return failed("coverage-ideal")
    return days.map((weekday) => ({ weekday, start, end, position: known.canon(position), min, ideal, peak }))
}

const isError = (value: unknown): value is ImportError => typeof value === "object" && value !== null && "code" in value

/**
 * Reads the quick import text into positions, people and coverage blocks. Pure: the screen previews it and the back end applies it.
 * People: `Name; position, position; wage per hour; hours per week`. Coverage: `days hours position minimum-ideal [peak]`, for example
 * `T2-T6 07:00-11:00 Barista 1-2`. Days are T2 to T7, CN, a range, a list or every day.
 */
export const parseImport = (input: ImportText, knownPositions: ReadonlyArray<string>): ParsedImport => {
    const positions = input.positions
        .split(/[\n,;]/u)
        .map((x) => x.trim())
        .filter((name, index, all) => name !== "" && all.findIndex((x) => fold(x) === fold(name)) === index)
    const known = knownOf([...knownPositions, ...positions])
    const lines = (text: string): Array<readonly [string, number]> =>
        text
            .split("\n")
            .flatMap((raw, index): Array<readonly [string, number]> =>
                raw.trim() === "" ? [] : [[raw.trim(), index + 1]],
            )
    const staffResults = lines(input.staff).map(([line, number]) => parseStaffLine(line, number, known))
    const blockResults = lines(input.coverage).map(([line, number]) => parseCoverageLine(line, number, known))
    return {
        positions,
        staff: staffResults.flatMap((r) => (isError(r) ? [] : [r])),
        blocks: blockResults.flatMap((r) => (isError(r) || !Array.isArray(r) ? [] : r)),
        errors: [...staffResults, ...blockResults].flatMap((r) => (isError(r) ? [r] : [])),
    }
}

/** Colours the positions of a new setup cycle through. */
export const POSITION_COLORS: ReadonlyArray<string> = [
    "#2f6fed",
    "#e8590c",
    "#2b8a3e",
    "#ae3ec9",
    "#0c8599",
    "#c2255c",
    "#5c7cfa",
    "#e67700",
]
