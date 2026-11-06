import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { accountingBookBlock } from "../../blocks/accounting/book.block"
import type { BookRecord } from "../../rules/accounting/book-view"

/** The props of the book as the Accounting spec sets them. */
export const bookFixtureProps: z.infer<(typeof accountingBookBlock)["props"]> = {
    title: { vi: "S\u1ed5", en: "Book" },
    searchLabel: {
        vi: "T\u00ecm theo s\u1ed1 ch\u1ee9ng t\u1eeb, kh\u00e1ch ho\u1eb7c n\u1ed9i dung",
        en: "Search by number, customer or note",
    },
    empty: { vi: "Ch\u01b0a c\u00f3 ch\u1ee9ng t\u1eeb n\u00e0o.", en: "No entries yet." },
    emptySearch: {
        vi: "Kh\u00f4ng c\u00f3 ch\u1ee9ng t\u1eeb n\u00e0o kh\u1edbp t\u00ecm ki\u1ebfm.",
        en: "No entry matches the search.",
    },
    searchParam: "q",
    filterParam: "status",
    selectParam: "selected",
    periodParam: "period",
    paneParam: "pane",
}

/** The entries of the canvas: an invoice paid, one still owed, an unmatched transfer, an expense. */
export const BOOK_FIXTURE_RECORDS: ReadonlyArray<BookRecord> = [
    {
        id: "e1",
        title: "H\u0110-0141 \u00b7 Anh Khoa",
        entryDate: "2026-11-03",
        amountVnd: 1_950_000,
        status: "paid",
        counterparty: "Li\u00ean k\u1ebft \u0110\u01a1n #1090 \u00b7 \u0111\u00e3 thu 03/11",
    },
    {
        id: "e2",
        title: "H\u0110-0140 \u00b7 C\u00f4ng ty T\u00e2n Ph\u00e1t",
        entryDate: "2026-10-29",
        amountVnd: 8_400_000,
        status: "open",
        counterparty: "H\u1ea1n 10/11 \u00b7 \u0110\u01a1n h\u00e0ng #1087",
    },
    {
        id: "e3",
        title: "SePay \u00b7 CK HOA SEN SPA",
        entryDate: "2026-11-04",
        amountVnd: 3_500_000,
        status: "review",
        counterparty: "Ch\u01b0a kh\u1edbp h\u00f3a \u0111\u01a1n",
    },
    {
        id: "e4",
        title: "PC-0012 \u00b7 Mua kh\u0103n b\u00f4ng",
        entryDate: "2026-10-27",
        amountVnd: 1_280_000,
        status: "expense",
        counterparty: "Chi ph\u00ed \u00b7 Spa",
    },
]

/** The counts under the tabs of the canvas. */
export const BOOK_FIXTURE_COUNTS = { counts: { paid: 11, open: 6, expense: 4, review: 3 }, total: 24 }

/** The statuses a read is drawn in. */
type Status = "ready" | "empty" | "error" | "loading" | "forbidden"

/** The two reads of the book in every status. */
export interface BookFixtureSlots {
    /** The entries read. */
    readonly rows: Readonly<Record<Status, DataSlot<ReadonlyArray<BookRecord>>>>
    /** The counts read. */
    readonly counts: Readonly<Record<Status, DataSlot<typeof BOOK_FIXTURE_COUNTS>>>
}

/** The book in every status of its reads. */
export const bookFixtures: BookFixtureSlots = {
    rows: {
        ready: { items: BOOK_FIXTURE_RECORDS },
        empty: { isEmpty: true },
        error: { isError: true },
        loading: { isLoading: true },
        forbidden: { isForbidden: true },
    },
    counts: {
        ready: { items: BOOK_FIXTURE_COUNTS },
        empty: { isEmpty: true },
        error: { isError: true },
        loading: { isLoading: true },
        forbidden: { isForbidden: true },
    },
}
