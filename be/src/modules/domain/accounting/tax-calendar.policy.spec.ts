import { Test } from "@nestjs/testing"
import type { TaxProfile, UpcomingDue } from "./accounting-desk.contracts"
import {
    addDays,
    daysBetween,
    isWorkingDay,
    nextWorkingDay,
    remindersToday,
    payablesDue,
    supplierDueOn,
    taxDeadlines,
    upcomingDues,
} from "./tax-calendar.policy"

const SUBJECT = Symbol("tax-calendar.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    addDays,
                    daysBetween,
                    isWorkingDay,
                    nextWorkingDay,
                    remindersToday,
                    payablesDue,
                    supplierDueOn,
                    taxDeadlines,
                    upcomingDues,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./tax-calendar.policy")>(SUBJECT)
}

const MONTHLY: TaxProfile = {
    taxCode: "0100109106",
    vatPeriod: "monthly",
    withholdsPit: true,
    paysLicenseFee: false,
    establishedYear: 2020,
    reminderDays: 7,
    supplierTermDays: 30,
}

const QUARTERLY: TaxProfile = {
    ...MONTHLY,
    vatPeriod: "quarterly",
    withholdsPit: false,
    paysLicenseFee: true,
    establishedYear: 2026,
}

describe("tax-calendar.policy", () => {
    it("does date arithmetic and moves deadlines off weekends and public holidays", async () => {
        const subject = await build()

        expect(subject.addDays("2026-12-31", 1)).toBe("2027-01-01")
        expect(subject.addDays("2026-03-01", -1)).toBe("2026-02-28")
        expect(subject.daysBetween("2026-10-20", "2026-11-02")).toBe(13)
        expect(subject.isWorkingDay("2026-10-20")).toBe(true)
        expect(subject.isWorkingDay("2026-10-31")).toBe(false)
        expect(subject.isWorkingDay("2026-11-01")).toBe(false)
        expect(subject.isWorkingDay("2026-09-02")).toBe(false)
        expect(subject.isWorkingDay("2026-02-18")).toBe(false)
        expect(subject.nextWorkingDay("2026-02-20")).toBe("2026-02-23")
        expect(subject.nextWorkingDay("2026-10-30")).toBe("2026-10-30")
        expect(subject.supplierDueOn("2026-10-02", 30)).toBe("2026-11-02")
    })

    it("lists the monthly VAT and withheld PIT on the 20th and the quarterly CIT provisional payment", async () => {
        const subject = await build()

        expect(subject.taxDeadlines(MONTHLY, "2026-10-01", "2026-10-31")).toEqual([
            expect.objectContaining({ kind: "pit", period: "2026-09", dueOn: "2026-10-20" }),
            expect.objectContaining({ kind: "vat", period: "2026-09", dueOn: "2026-10-20" }),
            expect.objectContaining({ kind: "cit_provisional", period: "2026-Q3", dueOn: "2026-10-30" }),
        ])
        expect(subject.taxDeadlines(MONTHLY, "2026-02-01", "2026-02-28")).toEqual([
            expect.objectContaining({ kind: "pit", period: "2026-01", dueOn: "2026-02-23" }),
            expect.objectContaining({ kind: "vat", period: "2026-01", dueOn: "2026-02-23" }),
        ])
        expect(subject.taxDeadlines({ ...MONTHLY, withholdsPit: false }, "2026-10-20", "2026-10-20")).toEqual([
            expect.objectContaining({ kind: "vat", period: "2026-09" }),
        ])
        expect(subject.taxDeadlines(MONTHLY, "2027-03-01", "2027-03-31")).toEqual([
            expect.objectContaining({ kind: "pit", period: "2027-02", dueOn: "2027-03-22" }),
            expect.objectContaining({ kind: "vat", period: "2027-02", dueOn: "2027-03-22" }),
            expect.objectContaining({ kind: "cit_finalization", period: "2026", dueOn: "2027-03-31" }),
            expect.objectContaining({ kind: "pit_finalization", period: "2026", dueOn: "2027-03-31" }),
        ])
    })

    it("lists quarterly VAT at the end of the next quarter's first month and the license fee after the first year", async () => {
        const subject = await build()

        expect(
            subject.taxDeadlines(QUARTERLY, "2026-10-01", "2027-02-28").map((row) => [row.kind, row.period, row.dueOn]),
        ).toEqual([
            ["cit_provisional", "2026-Q3", "2026-10-30"],
            ["vat", "2026-Q3", "2026-11-02"],
            ["cit_provisional", "2026-Q4", "2027-02-01"],
            ["license_fee", "2027", "2027-02-01"],
            ["vat", "2026-Q4", "2027-02-01"],
        ])
        expect(subject.taxDeadlines({ ...QUARTERLY, withholdsPit: true }, "2026-11-01", "2026-11-30")).toEqual([
            expect.objectContaining({ kind: "pit", period: "2026-Q3", dueOn: "2026-11-02" }),
            expect.objectContaining({ kind: "vat", period: "2026-Q3", dueOn: "2026-11-02" }),
        ])
        expect(subject.taxDeadlines({ ...QUARTERLY, establishedYear: 2027 }, "2027-01-01", "2027-02-28")).toEqual([
            expect.objectContaining({ kind: "cit_provisional", dueOn: "2027-02-01" }),
            expect.objectContaining({ kind: "vat", dueOn: "2027-02-01" }),
        ])
    })
})

describe("tax-calendar.policy upcoming dues", () => {
    it("dates supplier invoices with the supplier's own term or the default", async () => {
        const subject = await build()
        const payable = (sellerTaxCode: string) => ({
            supplier: "S",
            sellerTaxCode,
            invoiceNo: "1",
            amountVnd: 5,
            issuedOn: "2026-10-02",
        })

        expect(
            subject
                .payablesDue([payable("A"), payable("B")], [{ name: "S", taxCode: "A", termDays: 7 }], 30)
                .map((row) => row.dueOn),
        ).toEqual(["2026-10-09", "2026-11-02"])
    })

    it("merges tax deadlines and supplier payments within the horizon, overdue ones first", async () => {
        const subject = await build()
        const payables = [
            { supplier: "NCC Linh An", invoiceNo: "000017", amountVnd: 4_620_000, dueOn: "2026-10-18" },
            { supplier: "NCC Xa", invoiceNo: "000099", amountVnd: 1_000_000, dueOn: "2026-12-30" },
            { supplier: "NCC Mai", invoiceNo: "000020", amountVnd: 800_000, dueOn: "2026-10-30" },
        ]

        const dues = subject.upcomingDues(QUARTERLY, payables, "2026-10-20", 30)

        expect(dues.map((row) => [row.source, row.ref, row.daysLeft, row.amountVnd])).toEqual([
            ["supplier", "000017", -2, 4_620_000],
            ["supplier", "000020", 10, 800_000],
            ["tax", "2026-Q3", 10, null],
            ["tax", "2026-Q3", 13, null],
        ])
        expect(dues[0]?.note).toBe("NCC Linh An")
        expect(subject.remindersToday(dues, 10).map((row) => row.kind)).toEqual(["supplier_payment", "cit_provisional"])
    })

    it("reminds on the configured lead day, the day before and the day itself", async () => {
        const subject = await build()
        const due = (daysLeft: number, ref: string): UpcomingDue => ({
            source: "tax",
            kind: "vat",
            ref,
            dueOn: "2026-10-20",
            daysLeft,
            amountVnd: null,
            note: "",
        })

        const picked = subject.remindersToday([due(7, "a"), due(1, "b"), due(0, "c"), due(3, "d"), due(-1, "e")], 7)

        expect(picked.map((row) => row.ref)).toEqual(["a", "b", "c"])
    })
})
