import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { BookEntryKind } from "../../rules/accounting/accounting.types"

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
