import { dueAtOf, INVOICE_TERM_DAYS, invoicePrefixOf, nextInvoiceNumber } from "./invoice-number"

describe("invoice numbers", () => {
    it("prefixes a number with the month on the shop wall", () => {
        expect(invoicePrefixOf(new Date("2026-10-15T05:00:00.000Z"))).toBe("INV-202610-")
        expect(invoicePrefixOf(new Date("2026-10-31T18:00:00.000Z"))).toBe("INV-202611-")
    })

    it("starts a month at 1 and goes on from the last number", () => {
        expect(nextInvoiceNumber("INV-202610-", null, 0)).toBe("INV-202610-0001")
        expect(nextInvoiceNumber("INV-202610-", "INV-202610-0041", 0)).toBe("INV-202610-0042")
    })

    it("moves on by the clashes it already had, and restarts from a last number it cannot read", () => {
        expect(nextInvoiceNumber("INV-202610-", "INV-202610-0041", 2)).toBe("INV-202610-0044")
        expect(nextInvoiceNumber("INV-202610-", "INV-202610-xx", 0)).toBe("INV-202610-0001")
    })

    it("falls due after the term", () => {
        const now = new Date("2026-11-01T00:00:00.000Z")
        expect(dueAtOf(now).getTime() - now.getTime()).toBe(INVOICE_TERM_DAYS * 86_400_000)
    })
})
