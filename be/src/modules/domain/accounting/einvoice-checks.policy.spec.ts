import { Test } from "@nestjs/testing"
import type { EinvoiceDraft } from "./accounting-desk.contracts"
import { VAT_RATES, checkEinvoice, exceptionCard, exceptionText, supplierOf } from "./einvoice-checks.policy"
import { CARD_COPY, EXCEPTION_COPY, issueText } from "./messages/accounting-desk.messages"

const SUBJECT = Symbol("einvoice-checks.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { checkEinvoice, exceptionCard, exceptionText, supplierOf } }],
    }).compile()
    return moduleRef.get<typeof import("./einvoice-checks.policy")>(SUBJECT)
}

const OWN = "0108896128"
const SUPPLIERS = [{ name: "CONG TY TNHH LINH DAN", taxCode: "0100109106" }]

const draft = (overrides: Partial<EinvoiceDraft> = {}): EinvoiceDraft => ({
    source: "xml",
    template: "1",
    series: "C26TLA",
    invoiceNo: "17",
    issuedOn: "2026-10-19",
    sellerName: "Cong ty TNHH Linh Dan",
    sellerTaxCode: "0100109106",
    buyerName: "HAKUEN",
    buyerTaxCode: OWN,
    lines: [
        { name: "Towel", quantity: 20, amountVnd: 2_000_000, vatRate: 10 },
        { name: "Oil", quantity: 10, amountVnd: 2_200_000, vatRate: null },
    ],
    subtotalVnd: 4_200_000,
    vatVnd: 200_000,
    totalVnd: 4_400_000,
    ...overrides,
})

describe("einvoice-checks.policy", () => {
    it("passes an invoice whose codes and amounts hold", async () => {
        const subject = await build()

        expect(VAT_RATES).toEqual([0, 5, 8, 10])
        expect(subject.checkEinvoice(draft(), OWN, SUPPLIERS)).toEqual({ status: "valid", issues: [] })
        expect(subject.checkEinvoice(draft({ vatVnd: 200_001, totalVnd: 4_400_001 }), "", [])).toEqual({
            status: "valid",
            issues: [],
        })
    })

    it("flags a seller tax code that differs from the supplier on file, or is malformed, and a foreign buyer", async () => {
        const subject = await build()

        expect(subject.checkEinvoice(draft({ sellerTaxCode: "0108896125" }), OWN, SUPPLIERS)).toEqual({
            status: "invalid_tax_code",
            issues: ["seller_tax_code_format"],
        })
        expect(subject.checkEinvoice(draft({ sellerTaxCode: "0100109106-001" }), OWN, SUPPLIERS)).toEqual({
            status: "invalid_tax_code",
            issues: ["seller_tax_code_mismatch"],
        })
        expect(subject.checkEinvoice(draft({ buyerTaxCode: "0100109106" }), OWN, SUPPLIERS)).toEqual({
            status: "invalid_tax_code",
            issues: ["buyer_tax_code_mismatch"],
        })
    })

    it("flags subtotal, VAT, total and rate problems as needing review", async () => {
        const subject = await build()
        const check = (overrides: Partial<EinvoiceDraft>) => subject.checkEinvoice(draft(overrides), OWN, SUPPLIERS)

        expect(check({ subtotalVnd: 4_000_000, totalVnd: 4_200_000 }).issues).toEqual(["subtotal_mismatch"])
        expect(check({ vatVnd: 420_000, totalVnd: 4_620_000 })).toEqual({
            status: "needs_review",
            issues: ["vat_mismatch"],
        })
        expect(check({ totalVnd: 4_620_000 }).issues).toEqual(["total_mismatch"])
        expect(check({ lines: [{ name: "x", quantity: 1, amountVnd: 4_200_000, vatRate: 7 }] }).issues).toEqual([
            "vat_rate_invalid",
        ])
        expect(check({ lines: [] }).issues).toEqual(["vat_mismatch"])
    })

    it("asks for review when the essentials are missing", async () => {
        const subject = await build()

        expect(subject.checkEinvoice(draft({ invoiceNo: "" }), OWN, SUPPLIERS).issues).toEqual(["missing_fields"])
        expect(subject.checkEinvoice(draft({ sellerTaxCode: "" }), OWN, SUPPLIERS).status).toBe("needs_review")
        expect(subject.checkEinvoice(draft({ totalVnd: 0 }), OWN, SUPPLIERS).status).toBe("needs_review")
    })

    it("finds the supplier by its name regardless of case and accents", async () => {
        const subject = await build()

        expect(subject.supplierOf(draft(), SUPPLIERS)?.taxCode).toBe("0100109106")
        expect(subject.supplierOf(draft({ sellerName: "Other" }), SUPPLIERS)).toBeNull()
        expect(subject.supplierOf(draft({ sellerName: " - " }), SUPPLIERS)).toBeNull()
    })
})

describe("einvoice-checks.policy room copy", () => {
    it("writes the exception line with the reasons, the proposal and the codes", async () => {
        const subject = await build()
        const mismatch = { status: "invalid_tax_code" as const, issues: ["seller_tax_code_mismatch" as const] }

        expect(subject.exceptionText(draft(), mismatch, { name: "Linh", taxCode: "0100109106-001" })).toBe(
            [
                EXCEPTION_COPY.head("Cong ty TNHH Linh Dan", "17", 4_400_000),
                `- ${issueText("seller_tax_code_mismatch")}`,
                EXCEPTION_COPY.proposeTaxCode,
                EXCEPTION_COPY.onFile("0100109106", "0100109106-001"),
            ].join("\n"),
        )
        const review = subject.exceptionText(draft(), { status: "needs_review", issues: ["missing_fields"] }, null)
        expect(review).toContain(EXCEPTION_COPY.proposeReview)
        expect(review).toContain(EXCEPTION_COPY.onInvoice("0100109106"))
    })

    it("builds the hub exception card with the codes on the invoice and on file", async () => {
        const subject = await build()

        const card = subject.exceptionCard(
            draft(),
            { status: "invalid_tax_code", issues: ["seller_tax_code_mismatch"] },
            { name: "Linh", taxCode: "0100109106-001" },
        )

        expect(card).toEqual(
            expect.objectContaining({
                v: 1,
                type: "exception",
                badge: CARD_COPY.badgeTaxCode,
                data: expect.objectContaining({ issues: ["seller_tax_code_mismatch"], issuedOn: "2026-10-19" }),
            }),
        )
        expect(card.fields).toHaveLength(4)
        expect(card.fields?.[0]).toEqual({ label: CARD_COPY.invoiceNo, value: "C26TLA 17" })
        const review = subject.exceptionCard(draft(), { status: "needs_review", issues: ["vat_mismatch"] }, null)
        expect(review.badge).toBe(CARD_COPY.badgeReview)
        expect(review.fields).toHaveLength(3)
        expect(review.lines).toEqual([{ text: issueText("vat_mismatch") }])
    })
})
