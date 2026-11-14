import { Test } from "@nestjs/testing"
import { tt78Xml } from "../../../../tests/fixtures/builders/einvoice.builder"
import { amountOf, parseEinvoiceXml, vatRateOf } from "./einvoice-xml.policy"

const SUBJECT = Symbol("einvoice-xml.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { amountOf, parseEinvoiceXml, vatRateOf } }],
    }).compile()
    return moduleRef.get<typeof import("./einvoice-xml.policy")>(SUBJECT)
}

describe("einvoice-xml.policy", () => {
    it("reads a TT78 invoice wrapped in a tax-authority message", async () => {
        const subject = await build()

        expect(subject.parseEinvoiceXml(tt78Xml())).toEqual({
            source: "xml",
            template: "1",
            series: "C26TLA",
            invoiceNo: "17",
            issuedOn: "2026-10-19",
            sellerName: "Cong ty TNHH Linh An",
            sellerTaxCode: "0100109106",
            buyerName: "HAKUEN Hotel & Spa",
            buyerTaxCode: "0108896128",
            lines: [
                { name: "Khan tam cotton", quantity: 20, amountVnd: 2_000_000, vatRate: 10 },
                { name: "Dau massage <thao moc>", quantity: 10, amountVnd: 2_200_000, vatRate: null },
            ],
            subtotalVnd: 4_200_000,
            vatVnd: 200_000,
            totalVnd: 4_400_000,
        })
    })

    it("answers null for broken XML or a document without HDon, and blanks for missing sections", async () => {
        const subject = await build()

        expect(subject.parseEinvoiceXml("<HDon>")).toBeNull()
        expect(subject.parseEinvoiceXml("<Other/>")).toBeNull()
        expect(subject.parseEinvoiceXml("<HDon><DLHDon/></HDon>")).toEqual(
            expect.objectContaining({ invoiceNo: "", sellerTaxCode: "", lines: [], totalVnd: 0 }),
        )
    })

    it("reads amounts and VAT rates the way TT78 writes them", async () => {
        const subject = await build()

        expect(subject.amountOf(" 1500.5 ")).toBe(1500.5)
        expect(subject.amountOf("")).toBe(0)
        expect(subject.amountOf("abc")).toBe(0)
        expect(subject.vatRateOf("8%")).toBe(8)
        expect(subject.vatRateOf("khac:3.5%")).toBe(3.5)
        expect(subject.vatRateOf("KKKNT")).toBeNull()
        expect(subject.vatRateOf("")).toBeNull()
        expect(subject.vatRateOf("ten")).toBeNaN()
    })
})
