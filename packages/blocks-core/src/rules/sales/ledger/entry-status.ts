import type { BookEntryKind } from "./accounting.types"

/** Where an entry stands for the person reading the books: money in, money still owed, money out, or a line to look at again. */
export const ENTRY_STATUSES: readonly ["paid", "open", "expense", "review"] = ["paid", "open", "expense", "review"]

/** One status of an entry. */
export type EntryStatus = (typeof ENTRY_STATUSES)[number]

/** The status an entry of a kind has: income is paid, an invoice is still owed, an expense is money out, a correction needs a second look. */
export const entryStatusOf = (kind: BookEntryKind): EntryStatus => {
    switch (kind) {
        case "income":
            return "paid"
        case "invoice":
            return "open"
        case "expense":
            return "expense"
        case "reversal":
        case "adjustment":
            return "review"
    }
}
