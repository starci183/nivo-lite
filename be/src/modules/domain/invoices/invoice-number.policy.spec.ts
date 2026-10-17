import { Test } from "@nestjs/testing"
import { dueAtOf, invoicePrefixOf, nextInvoiceNumber } from "./invoice-number.policy"

const SUBJECT = Symbol("invoice-number.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { dueAtOf, invoicePrefixOf, nextInvoiceNumber } }],
    }).compile()
    return moduleRef.get<
        Pick<typeof import("./invoice-number.policy"), "dueAtOf" | "invoicePrefixOf" | "nextInvoiceNumber">
    >(SUBJECT)
}

describe("invoice-number policy", () => {
    it("uses the shop's month at the UTC month boundary", async () => {
        const subject = await buildSubject()

        expect(subject.invoicePrefixOf(new Date("2026-09-30T16:59:59.000Z"))).toBe("INV-202609-")
        expect(subject.invoicePrefixOf(new Date("2026-09-30T17:00:00.000Z"))).toBe("INV-202610-")
    })

    it("starts an empty month at one and moves past skipped numbers", async () => {
        const subject = await buildSubject()

        expect(subject.nextInvoiceNumber("INV-202610-", null, 0)).toBe("INV-202610-0001")
        expect(subject.nextInvoiceNumber("INV-202610-", null, 3)).toBe("INV-202610-0004")
    })

    it("increments the last monthly number and keeps numbers beyond four digits", async () => {
        const subject = await buildSubject()

        expect(subject.nextInvoiceNumber("INV-202610-", "INV-202610-0042", 2)).toBe("INV-202610-0045")
        expect(subject.nextInvoiceNumber("INV-202610-", "INV-202610-9999", 0)).toBe("INV-202610-10000")
    })

    it("starts from zero when the last suffix is invalid or zero", async () => {
        const subject = await buildSubject()

        expect(subject.nextInvoiceNumber("INV-202610-", "INV-202610-invalid", 0)).toBe("INV-202610-0001")
        expect(subject.nextInvoiceNumber("INV-202610-", "INV-202610-0000", 0)).toBe("INV-202610-0001")
    })

    it("makes the invoice due fifteen days after issue without changing the issue date", async () => {
        const subject = await buildSubject()

        const issuedAt = new Date("2026-12-20T10:30:45.123Z")

        expect(subject.dueAtOf(issuedAt).toISOString()).toBe("2027-01-04T10:30:45.123Z")
        expect(issuedAt.toISOString()).toBe("2026-12-20T10:30:45.123Z")
    })
})
