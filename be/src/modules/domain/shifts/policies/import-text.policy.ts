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

const WEEK_ALL: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6]

type DayToken = "t2" | "t3" | "t4" | "t5" | "t6" | "t7" | "cn"

const DAY_TOKENS: Readonly<Record<DayToken, number>> = { t2: 0, t3: 1, t4: 2, t5: 3, t6: 4, t7: 5, cn: 6 }

interface DayCaptures {
    readonly from: DayToken
    readonly to: DayToken | undefined
}

interface DayRange {
    readonly from: number
    readonly to: number
}

interface DayRangeResult {
    range: DayRange | null
}

interface ClockCaptures {
    readonly hours: string | undefined
    readonly minutes: string | undefined
}

interface CoverageCaptures {
    readonly days: string
    readonly startHours: string | undefined
    readonly startMinutes: string | undefined
    readonly endHours: string | undefined
    readonly endMinutes: string | undefined
    readonly position: string
    readonly minimum: string | undefined
    readonly ideal: string | undefined
}

const EVERY_DAY: ReadonlySet<string> = new Set(["moingay", "hangngay", "t2-cn", "t2-t7-cn"])

const MAX_WEEK_HOURS = 100

const THOUSAND = 1000

const HOURS_PER_DAY = 24

const MINUTES_PER_HOUR = 60

/** Lower case, no accents, single spaces: how names and keywords are compared. */
export const fold = (text: string): string =>
    text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replaceAll("\u0111", "d").replace(/\s+/gu, " ").trim()

/** The weekdays a day expression names (T2, T2-T6, T2,T4, CN, every day), or null when it is not one. */
const parseDays = (raw: string): Array<number> | null => {
    const text = fold(raw).replace(/\s+/gu, "")
    if (EVERY_DAY.has(text)) return [...WEEK_ALL]
    const days = new Set<number>()
    for (const part of text.split(",")) {
        const parsed: DayRangeResult = { range: null }
        part.replace(
            /^(?<from>t[2-7]|cn)(?:-(?<to>t[2-7]|cn))?$/u,
            (
                _match: string,
                _from: string,
                _to: string | undefined,
                _offset: number,
                _text: string,
                { from, to }: DayCaptures,
            ) => {
                parsed.range = { from: DAY_TOKENS[from], to: to === undefined ? DAY_TOKENS[from] : DAY_TOKENS[to] }
                return ""
            },
        )
        if (parsed.range === null) return null
        const { from, to } = parsed.range
        if (to < from) return null
        for (let day = from; day <= to; day++) days.add(day)
    }
    return [...days].sort((a, b) => a - b)
}

/** An HH:MM time from the coverage pattern's numeric captures; null when out of range. */
const parseClock = (captures: ClockCaptures): string | null => {
    const hours = Number(captures.hours)
    const minutes = captures.minutes === undefined ? 0 : Number(captures.minutes)
    if (hours >= HOURS_PER_DAY || minutes >= MINUTES_PER_HOUR) return null
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/** An hourly wage from 30k, 30000 or 30.000 (with an optional currency or per-hour suffix); null when unreadable. */
export const parseWage = (raw: string): number | null => {
    const text = raw.toLowerCase().replace(/\s|\u0111|vnd|\/h|\/gio/gu, "")
    const thousands = /^(\d+(?:[.,]\d+)?)k$/u.exec(text)
    if (thousands !== null) return Math.round(Number(text.slice(0, -1).replace(",", ".")) * THOUSAND)
    const value = Number(text.replace(/[.,](?=\d{3}\b)/gu, ""))
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
}

type Known = (name: string) => string | undefined

const knownOf =
    (names: ReadonlyArray<string>): Known =>
    (name) =>
        names.find((known) => fold(known) === fold(name))

const parseStaffLine = (line: string, number: number, known: Known): ParsedStaff | ImportError => {
    const parts = line.split(/[;|\t]/u).map((x) => x.trim())
    let name = ""
    let positionText = ""
    parts.forEach((part, index) => {
        if (index === 0) name = part
        if (index === 1) positionText = part
    })
    const failed = (code: ImportErrorCode, subject = name): ImportError => ({ code, line: number, subject })
    if (parts.length < 2 || name === "") return failed("staff-format", "")
    const requested = positionText
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x !== "")
    const positions: Array<string> = []
    const unknown: Array<string> = []
    requested.forEach((position) => {
        const canonical = known(position)
        if (canonical === undefined) unknown.push(position)
        else positions.push(canonical)
    })
    if (requested.length === 0) return failed("staff-position-missing")
    if (unknown.length > 0) return failed("staff-position-unknown", unknown.join(", "))
    const wage = parts[2] ? parseWage(parts[2]) : 0
    if (wage === null) return failed("staff-wage")
    const maxWeek = parts[3] ? Number(parts[3].replace(",", ".")) : null
    if (maxWeek !== null && (!Number.isFinite(maxWeek) || maxWeek <= 0 || maxWeek > MAX_WEEK_HOURS)) {
        return failed("staff-hours")
    }
    return { name, positions, wage, maxWeek }
}

/** The blocks one coverage line expands to (one per day). */
interface ParsedBlocks {
    readonly blocks: Array<ParsedBlock>
}

const parseCoverageLine = (line: string, number: number, known: Known): ParsedBlocks | ImportError => {
    const folded = fold(line)
    const peak = /(cao diem|peak)\s*$/u.test(folded)
    const body = folded.replace(/(cao diem|peak)\s*$/u, "").trim()
    const failed = (code: ImportErrorCode, subject = ""): ImportError => ({ code, line: number, subject })
    const read = (captures: CoverageCaptures): ParsedBlocks | ImportError => {
        const days = parseDays(captures.days)
        const start = parseClock({ hours: captures.startHours, minutes: captures.startMinutes })
        const end = parseClock({ hours: captures.endHours, minutes: captures.endMinutes })
        const min = Number(captures.minimum)
        const ideal = captures.ideal === undefined ? min : Number(captures.ideal)
        if (days === null) return failed("coverage-days", captures.days)
        if (start === null || end === null || start >= end) return failed("coverage-times")
        const position = known(captures.position)
        if (position === undefined) return failed("coverage-position", captures.position)
        if (ideal < min) return failed("coverage-ideal")
        return { blocks: days.map((weekday) => ({ weekday, start, end, position, min, ideal, peak })) }
    }
    const counts = / (?<minimum>\d{1,2})(?: ?[-–] ?(?<ideal>\d{1,2}))?$/u.exec(body)
    if (counts?.groups === undefined) return failed("coverage-format")
    const prefix = body.slice(0, counts.index)
    const time =
        / (?<startHours>\d{1,2})(?:[:h](?<startMinutes>\d{2}))? ?[-–] ?(?<endHours>\d{1,2})(?:[:h](?<endMinutes>\d{2}))? /u.exec(
            prefix,
        )
    if (time?.groups === undefined) return failed("coverage-format")
    const days = prefix.slice(0, time.index)
    const position = prefix.slice(time.index + time[0].length)
    return read({
        days,
        position,
        startHours: time.groups.startHours,
        startMinutes: time.groups.startMinutes,
        endHours: time.groups.endHours,
        endMinutes: time.groups.endMinutes,
        minimum: counts.groups.minimum,
        ideal: counts.groups.ideal,
    })
}

const isError = (value: ParsedStaff | ImportError | ParsedBlocks): value is ImportError => "code" in value

/** The non-blank lines of a text with their one-based line numbers. */
const numberedLines = (text: string): Array<readonly [string, number]> =>
    text
        .split("\n")
        .flatMap((raw, index): Array<readonly [string, number]> => (raw.trim() === "" ? [] : [[raw.trim(), index + 1]]))

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
    const staffResults = numberedLines(input.staff).map(([line, number]) => parseStaffLine(line, number, known))
    const blockResults = numberedLines(input.coverage).map(([line, number]) => parseCoverageLine(line, number, known))
    return {
        positions,
        staff: staffResults.flatMap((r) => (isError(r) ? [] : [r])),
        blocks: blockResults.flatMap((r) => (isError(r) ? [] : r.blocks)),
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
