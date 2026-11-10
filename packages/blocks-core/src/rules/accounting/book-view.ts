import { z } from "zod"
import { MAX_ENTRIES, MAX_ID, MAX_LINE } from "../../bounds"
import { formatValue } from "../../rows/cell-format"
import type { CellTone } from "../../rows/table-rows"
import { ENTRY_STATUSES, type EntryStatus } from "./entry-status"

/** The language the book draws money in, whatever the viewer reads: the books are Vietnamese dong, written the Vietnamese way. */
const MONEY_LOCALE = "vi-VN"

/** The tone of the status mark of each entry: money in is settled, money owed and lines to look at again ask for the eye, money out is plain. */
export const BOOK_TONES: Readonly<Record<EntryStatus, CellTone>> = {
    paid: "success",
    open: "warning",
    expense: "neutral",
    review: "warning",
}

/** One entry of the book as the entries read answers it. */
export interface BookRecord {
    /** The entry id. */
    readonly id: string
    /** The first line of the row: the number and the name of the document; absent draws an empty line. */
    readonly note?: string | null | undefined
    /** The shop day of the entry, `YYYY-MM-DD`. */
    readonly entryDate: string
    /** The amount, in VND. */
    readonly amountVnd: number
    /** Where the entry stands. */
    readonly status: EntryStatus
    /** The customer or supplier the entry is with, for the second line; absent, null or empty draws none. */
    readonly counterparty?: string | null | undefined
}

/** The records of the entries read, each judged by its fields: a record that does not fit fails the whole read. */
export const bookRecords: z.ZodType<ReadonlyArray<BookRecord>> = z
    .array(
        z.looseObject({
            id: z.string().min(1).max(MAX_ID),
            note: z.string().max(MAX_LINE).nullable().optional(),
            entryDate: z.string().max(MAX_ID),
            amountVnd: z.number(),
            status: z.enum(ENTRY_STATUSES),
            counterparty: z.string().max(MAX_LINE).nullable().optional(),
        }),
    )
    .max(MAX_ENTRIES)

/** One row of the book as it is drawn. */
export interface BookRow {
    /** The key of the row, and the entry a choice of it names. */
    readonly id: string
    /** The day, written day then month. */
    readonly date: string
    /** The first line. */
    readonly title: string
    /** The second line; empty draws none. */
    readonly subline: string
    /** The amount, written as Vietnamese dong. */
    readonly amount: string
    /** The words of the status mark. */
    readonly status: string
    /** The tone of the status mark. */
    readonly tone: CellTone
}

/** The amount as Vietnamese dong written the Vietnamese way (`6.000.000 VND`), whatever the language of the viewer. */
export const moneyOf = (vnd: number): string => formatValue(vnd, "money", { locale: MONEY_LOCALE, currency: "VND" })

/** The day of a `YYYY-MM-DD` entry date written day then month (`03/11`); a date that is not one is drawn as it is. */
export const dayOf = (entryDate: string): string => {
    const parts = /^\d{4}-(\d{2})-(\d{2})$/.exec(entryDate)
    return parts === null ? entryDate : `${parts[2]}/${parts[1]}`
}

/** The rows of the book: a record is a row with its day, its two lines, its amount and its status mark. */
export const bookRowsOf = (
    records: ReadonlyArray<BookRecord>,
    statusWord: (status: EntryStatus) => string,
): ReadonlyArray<BookRow> =>
    records.map((record) => ({
        id: record.id,
        date: dayOf(record.entryDate),
        title: record.note ?? "",
        subline: record.counterparty ?? "",
        amount: moneyOf(record.amountVnd),
        status: statusWord(record.status),
        tone: BOOK_TONES[record.status],
    }))

/** Which period the book is about. */
export type BookPeriod = "this" | "last"

/** The period a param value names; the current month for no value or one the book does not know. */
export const bookPeriodOf = (value: string | null): BookPeriod => (value === "last" ? "last" : "this")

/** The line after the title: the period and how many entries the book holds under the search, from a template with `{count}`. */
export const bookSubtitleOf = (period: string, count: number, countTemplate: string): string =>
    `${period} \u00b7 ${countTemplate.replaceAll("{count}", String(count))}`

/** One entry as a phone card: the name over the day and the second line, the amount at the end and the status mark. */
export interface PhoneCard {
    /** The key of the card, and the entry a press of it names. */
    readonly id: string
    /** The first line. */
    readonly title: string
    /** The day and the second line, joined; the day alone when there is no second line. */
    readonly description: string
    /** The amount. */
    readonly amount: string
    /** The words of the status mark. */
    readonly status: string
    /** The tone of the status mark. */
    readonly tone: CellTone
}

/** The card of a row on a phone: the day moves into the second line, so the card carries no labels. */
export const phoneCardOf = (row: BookRow): PhoneCard => ({
    id: row.id,
    title: row.title,
    description: row.subline === "" ? row.date : `${row.date} · ${row.subline}`,
    amount: row.amount,
    status: row.status,
    tone: row.tone,
})

/** The order code a transfer text carries, written the way orders are numbered; empty when it carries none. */
export const orderCodeIn = (text: string): string => {
    const found = /DH-?(\d{8})-?(\d{4})/.exec(text)
    return found === null ? "" : `DH-${found[1]}-${found[2]}`
}
