import type { BookRecord } from "./book-view"
import {
    BOOK_TONES,
    bookPeriodOf,
    phoneCardOf,
    bookRecords,
    bookRowsOf,
    bookSubtitleOf,
    dayOf,
    moneyOf,
} from "./book-view"
import { ENTRY_STATUSES } from "./entry-status"

const RECORD: BookRecord = {
    id: "e1",
    note: "H\u0110-0141 \u00b7 Anh Khoa",
    entryDate: "2026-11-03",
    amountVnd: 1_950_000,
    status: "paid",
    counterparty: "Anh Khoa",
}

describe("bookRecords", () => {
    it("takes the entries the read answers, with or without a counterparty", () => {
        const { counterparty: _, ...bare } = RECORD
        expect(bookRecords.safeParse([RECORD, bare]).success).toBe(true)
    })

    it("refuses a status the book has no tab for", () => {
        expect(bookRecords.safeParse([{ ...RECORD, status: "weird" }]).success).toBe(false)
    })
})

describe("moneyOf", () => {
    it("writes dong the Vietnamese way", () => {
        expect(moneyOf(6_000_000).replace(/\s/g, " ")).toBe("6.000.000 \u20ab")
    })
})

describe("dayOf", () => {
    it("writes day then month and leaves what is not a day as it is", () => {
        expect(dayOf("2026-11-03")).toBe("03/11")
        expect(dayOf("soon")).toBe("soon")
    })
})

describe("bookRowsOf", () => {
    it("makes a row of the day, the two lines, the amount and the toned status", () => {
        const [first, second] = bookRowsOf(
            [
                { ...RECORD, status: "paid" },
                { id: "e2", note: "PC-0012", entryDate: "2026-10-27", amountVnd: 1_280_000, status: "expense" },
            ],
            (status) => `w:${status}`,
        )
        expect(first).toMatchObject({ id: "e1", date: "03/11", subline: "Anh Khoa", status: "w:paid", tone: "success" })
        expect(second).toMatchObject({ subline: "", status: "w:expense", tone: "neutral" })
    })

    it("gives every status a tone", () => {
        expect(ENTRY_STATUSES.map((status) => BOOK_TONES[status])).toEqual(["success", "warning", "neutral", "warning"])
    })
})

describe("the head", () => {
    it("names the current month unless the param says last", () => {
        expect(bookPeriodOf(null)).toBe("this")
        expect(bookPeriodOf("last")).toBe("last")
        expect(bookPeriodOf("x")).toBe("this")
    })

    it("writes the period and the count from the template", () => {
        expect(bookSubtitleOf("Th\u00e1ng n\u00e0y", 24, "{count} ch\u1ee9ng t\u1eeb")).toBe(
            "\u00b7 Th\u00e1ng n\u00e0y \u00b7 24 ch\u1ee9ng t\u1eeb",
        )
    })
})

describe("phoneCardOf", () => {
    it("puts the day in the second line, with the counterparty after it when there is one", () => {
        const [withLine, plain] = bookRowsOf(
            [RECORD, { ...RECORD, id: "e2", counterparty: undefined }],
            (status) => status,
        ).map(phoneCardOf)
        expect(withLine).toMatchObject({ id: "e1", description: "03/11 · Anh Khoa", status: "paid", tone: "success" })
        expect(plain?.description).toBe("03/11")
    })
})
