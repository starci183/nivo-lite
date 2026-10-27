import type { Table } from "@modules/integrations/data-sources"
import { CONTRACT_IMPORT_FIELDS } from "./contract-import.contracts"
import type {
    ContractImportField,
    ContractImportMapping,
    ContractImportProblem,
    ContractImportRow,
} from "./contract-import.contracts"
import { fold, parseNumberLoose } from "./csv-import-values.policy"
import { CONTRACT_IMPORT_COPY } from "./messages/contract-import.messages"

/** The header words of each field, most specific first, already folded (accent-free, lower case). */
const FIELD_WORDS: Readonly<Record<ContractImportField, ReadonlyArray<string>>> = {
    customerName: ["ten khach hang", "khach hang", "ten khach", "customer name", "customer", "client", "khach"],
    plan: [
        "ten du an",
        "ten website",
        "ten mien",
        "goi dich vu",
        "dich vu",
        "du an",
        "website",
        "domain",
        "goi",
        "plan",
        "service",
        "san pham",
    ],
    startsOn: ["thoi gian bat dau", "ngay bat dau", "bat dau", "start date", "starts on", "start", "tu ngay"],
    endsOn: [
        "thoi gian ket thuc",
        "ngay ket thuc",
        "ngay het han",
        "het han",
        "ket thuc",
        "end date",
        "ends on",
        "expiry date",
        "expiry",
        "expires",
        "expiration",
        "den ngay",
    ],
    amountVnd: ["gia tri", "so tien", "thanh tien", "gia", "phi", "amount", "price", "value", "fee"],
    status: ["trang thai", "tinh trang", "status"],
    note: ["ghi chu", "note", "notes", "mo ta", "description"],
}

/** The problems that keep a row out (the derived start is only a flag). */
const BLOCKING: ReadonlySet<ContractImportProblem> = new Set<ContractImportProblem>([
    "customerMissing",
    "endsOnMissing",
    "endsOnInvalid",
    "startsOnInvalid",
    "datesReversed",
    "amountInvalid",
    "duplicate",
])

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
const DAY_MS = 86_400_000
const EXCEL_SERIAL_MAX = 2_958_465
const NOTE_MAX = 500

const hasWord = (folded: string, word: string): boolean => ` ${folded} `.includes(` ${word} `)

const headerFor = (
    headers: ReadonlyArray<string>,
    words: ReadonlyArray<string>,
    taken: ReadonlySet<string>,
): string | null => {
    const free = headers.filter((header) => !taken.has(header))
    for (const word of words) {
        const exact = free.find((header) => fold(header) === word)
        if (exact !== undefined) return exact
        const partial = free.find((header) => hasWord(fold(header), word))
        if (partial !== undefined) return partial
    }
    return null
}

/** The chosen mapping kept to real header names; a field naming no column is null. */
export const mappingOf = (
    raw: Partial<Record<ContractImportField, string | null>> | null | undefined,
    headers: ReadonlyArray<string>,
): ContractImportMapping => {
    const column = (field: ContractImportField): string | null => {
        const value = raw?.[field] ?? null
        return value !== null && headers.includes(value) ? value : null
    }
    return {
        customerName: column("customerName"),
        plan: column("plan"),
        startsOn: column("startsOn"),
        endsOn: column("endsOn"),
        amountVnd: column("amountVnd"),
        status: column("status"),
        note: column("note"),
    }
}

/** Suggests a column for each contract field from Vietnamese and English header names; one column fills one field. */
export const suggestContractMapping = (headers: ReadonlyArray<string>): ContractImportMapping => {
    const taken = new Set<string>()
    const mapping: Partial<Record<ContractImportField, string | null>> = {}
    for (const field of CONTRACT_IMPORT_FIELDS) {
        const header = headerFor(headers, FIELD_WORDS[field], taken)
        if (header !== null) taken.add(header)
        mapping[field] = header
    }
    return mappingOf(mapping, headers)
}

const pad = (value: number): string => String(value).padStart(2, "0")

const dayOf = (year: number, month: number, day: number): string | null => {
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return null
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
    return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * A day as YYYY-MM-DD from YYYY-MM-DD (a time after it is ignored), DD/MM/YYYY (or with - or .) or an Excel serial day
 * number; undefined when the cell is empty, null when it cannot be read.
 */
export const parseImportDay = (raw: string): string | null | undefined => {
    const text = raw.trim()
    if (text === "") return undefined
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/u.exec(text)
    if (iso !== null) return dayOf(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/u.exec(text)
    if (local !== null) return dayOf(Number(local[3]), Number(local[2]), Number(local[1]))
    if (/^\d+(?:\.\d+)?$/u.test(text)) {
        const serial = Math.floor(Number(text))
        if (serial < 1 || serial > EXCEL_SERIAL_MAX) return null
        return new Date(EXCEL_EPOCH_MS + serial * DAY_MS).toISOString().slice(0, 10)
    }
    return null
}

/** The same calendar day one year earlier (29 February becomes 28 February). */
export const yearBefore = (day: string): string => {
    const [year = 0, month = 1, date = 1] = day.split("-").map(Number)
    return dayOf(year - 1, month, date) ?? dayOf(year - 1, month, date - 1) ?? day
}

/** The status of an imported contract: a cancelled word wins; an end day before today is ended unless the sheet says active; otherwise active. */
export const importStatus = (raw: string, endsOn: string | null, today: string): string => {
    const folded = fold(raw)
    if (hasWord(folded, "huy") || folded.includes("cancel")) return "cancelled"
    const saysActive = folded.includes("hoat dong") || folded === "active"
    if (endsOn !== null && endsOn < today && !saysActive) return "ended"
    return "active"
}

interface AmountRead {
    readonly value: number | null
    readonly bad: boolean
}

const amountOf = (raw: string): AmountRead => {
    if (raw === "") return { value: null, bad: false }
    const value = parseNumberLoose(raw)
    if (value === null || value < 0 || value > Number.MAX_SAFE_INTEGER) return { value: null, bad: true }
    return { value: Math.round(value), bad: false }
}

/** The key that makes two contracts the same: customer, plan and last day, compared without case or accents. */
export const contractKey = (customerName: string, plan: string, endsOn: string): string =>
    `${fold(customerName)}|${fold(plan)}|${endsOn}`

/** The first problem that keeps the row out, the reason a skipped row reports; null when the row can be saved. */
export const skipReason = (row: ContractImportRow): ContractImportProblem | null =>
    row.problems.find((problem) => BLOCKING.has(problem)) ?? null

interface DayRead {
    readonly startsOn: string | null
    readonly endsOn: string | null
    readonly derived: boolean
    readonly problems: ReadonlyArray<ContractImportProblem>
}

const readDays = (startCell: string, endCell: string): DayRead => {
    const problems: Array<ContractImportProblem> = []
    const ends = parseImportDay(endCell)
    if (ends === undefined) problems.push("endsOnMissing")
    if (ends === null) problems.push("endsOnInvalid")
    const endsOn = ends ?? null
    const starts = parseImportDay(startCell)
    if (starts === null) problems.push("startsOnInvalid")
    let startsOn = starts ?? null
    const derived = starts === undefined && endsOn !== null
    if (derived) {
        startsOn = yearBefore(endsOn)
        problems.push("startsOnDerived")
    }
    if (startsOn !== null && endsOn !== null && endsOn < startsOn) problems.push("datesReversed")
    return { startsOn, endsOn, derived, problems }
}

const columnIndexes = (table: Table, mapping: ContractImportMapping): Readonly<Record<ContractImportField, number>> => {
    const indexOf = (field: ContractImportField): number => {
        const header = mapping[field]
        return header === null ? -1 : table.headers.indexOf(header)
    }
    return {
        customerName: indexOf("customerName"),
        plan: indexOf("plan"),
        startsOn: indexOf("startsOn"),
        endsOn: indexOf("endsOn"),
        amountVnd: indexOf("amountVnd"),
        status: indexOf("status"),
        note: indexOf("note"),
    }
}

/**
 * Reads every data row as a contract with the mapping: the days, the amount, the status (judged at `today`, YYYY-MM-DD) and
 * the problems, including a duplicate of a contract the workspace has (`existing` keys) or of an earlier row.
 */
export const readContractRows = (
    table: Table,
    mapping: ContractImportMapping,
    today: string,
    existing: ReadonlySet<string>,
): ReadonlyArray<ContractImportRow> => {
    const seen = new Set(existing)
    const indexes = columnIndexes(table, mapping)
    return table.rows.map((cells, index) => {
        const cell = (field: ContractImportField): string => {
            const at = indexes[field]
            return at < 0 ? "" : (cells[at] ?? "").trim()
        }
        const customerName = cell("customerName")
        const plan = cell("plan")
        const days = readDays(cell("startsOn"), cell("endsOn"))
        const amount = amountOf(cell("amountVnd"))
        const problems: Array<ContractImportProblem> = []
        if (customerName === "") problems.push("customerMissing")
        problems.push(...days.problems)
        if (amount.bad) problems.push("amountInvalid")
        if (days.endsOn !== null && customerName !== "") {
            const key = contractKey(customerName, plan, days.endsOn)
            if (seen.has(key)) problems.push("duplicate")
            seen.add(key)
        }
        const note = [cell("note"), days.derived ? CONTRACT_IMPORT_COPY.derivedStart : ""]
            .filter((part) => part !== "")
            .join(" ")
            .slice(0, NOTE_MAX)
        return {
            row: index + 2,
            customerName,
            plan,
            startsOn: days.startsOn,
            endsOn: days.endsOn,
            amountVnd: amount.value,
            status: importStatus(cell("status"), days.endsOn, today),
            note,
            problems,
        }
    })
}
