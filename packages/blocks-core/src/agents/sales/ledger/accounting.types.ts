import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { BookEntryKind } from "./rules/accounting.types"
import type { EntryStatus } from "./rules/entry-status"

/** A row of the entries list: the declared fields of a book entry the list draws. */
export interface EntryRow {
    /** The entry id. */
    readonly id: string
    /** What the entry says, or null when nobody wrote a note. */
    readonly note: string | null
    /** The shop day of the entry, `YYYY-MM-DD`. */
    readonly entryDate: string
    /** What the entry records. */
    readonly kind: BookEntryKind
    /** The amount, in VND. */
    readonly amountVnd: number
    /** Where the entry stands for the person reading the books. */
    readonly status: EntryStatus
    /** The customer or the supplier the entry is with, for the second line of its row; null when unknown. */
    readonly counterparty: string | null
}

/** A range of shop calendar days, `[fromDay, toDay)`, as `YYYY-MM-DD`. */
export interface DayRange {
    /** The first day. */
    readonly fromDay: string
    /** The first day after the range. */
    readonly toDay: string
}

/** A range of instants, `[fromIso, toIso)`. */
export interface InstantRange {
    /** The first instant, ISO text. */
    readonly fromIso: string
    /** The first instant after the range, ISO text. */
    readonly toIso: string
}

/** The ports of the records a correction can point at. */
export interface TargetStores {
    /** The invoices. */
    readonly invoices: EntityApi
    /** The payments. */
    readonly transactions: EntityApi
}
