import { dueAtOf, invoicePrefixOf, nextInvoiceNumber } from "./invoice-number.policy"

describe("invoice-number policy", () => {
    it("uses the shop's month at the UTC month boundary", () => {
        expect(invoicePrefixOf(new Date("2026-09-30T16:59:59.000Z"))).toBe("INV-202609-")
        expect(invoicePrefixOf(new Date("2026-09-30T17:00:00.000Z"))).toBe("INV-202610-")
    })

    it("starts an empty month at one and moves past skipped numbers", () => {
        expect(nextInvoiceNumber("INV-202610-", null, 0)).toBe("INV-202610-0001")
        expect(nextInvoiceNumber("INV-202610-", null, 3)).toBe("INV-202610-0004")
    })

    it("increments the last monthly number and keeps numbers beyond four digits", () => {
        expect(nextInvoiceNumber("INV-202610-", "INV-202610-0042", 2)).toBe("INV-202610-0045")
        expect(nextInvoiceNumber("INV-202610-", "INV-202610-9999", 0)).toBe("INV-202610-10000")
    })

    it("starts from zero when the last suffix is invalid or zero", () => {
        expect(nextInvoiceNumber("INV-202610-", "INV-202610-invalid", 0)).toBe("INV-202610-0001")
        expect(nextInvoiceNumber("INV-202610-", "INV-202610-0000", 0)).toBe("INV-202610-0001")
    })

    it("makes the invoice due fifteen days after issue without changing the issue date", () => {
        const issuedAt = new Date("2026-12-20T10:30:45.123Z")

        expect(dueAtOf(issuedAt).toISOString()).toBe("2027-01-04T10:30:45.123Z")
        expect(issuedAt.toISOString()).toBe("2026-12-20T10:30:45.123Z")
    })
})
