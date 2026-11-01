import { Test } from "@nestjs/testing"
import { needsOcr } from "./scanned-pdf.policy"

const SUBJECT = Symbol("scanned-pdf.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { needsOcr } }],
    }).compile()
    return moduleRef.get<{ needsOcr: typeof needsOcr }>(SUBJECT)
}

describe("needsOcr", () => {
    it.each([
        ["scan.pdf", "application/pdf", ""],
        ["SCAN.PDF", "", "   \n\n"],
        ["scan.pdf", "application/pdf", "1\n\n2\n\n- 3 -"],
        ["upload", "application/pdf", ""],
    ])("marks the PDF %s (%s) with no words as needing OCR", async (name, type, text) => {
        const subject = await build()

        expect(subject.needsOcr(name, type, text)).toBe(true)
    })

    it.each([
        ["offer.pdf", "application/pdf", "Price 120,000"],
        ["notes.txt", "text/plain", ""],
        ["sheet.xlsx", "", ""],
        ["offer.pdf", "application/pdf", "Menu 1"],
    ])("leaves %s (%s) with %j to the other checks", async (name, type, text) => {
        const subject = await build()

        expect(subject.needsOcr(name, type, text)).toBe(false)
    })
})
