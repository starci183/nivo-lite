import { Test } from "@nestjs/testing"
import { dossierRowOf } from "@tests/fixtures/builders/brain-dossiers.builder"
import { documentCountsOf, toDossierRecord } from "./dossier-record.mapper"

const SUBJECT = Symbol("dossier-record.mapper")
type Subject = { documentCountsOf: typeof documentCountsOf; toDossierRecord: typeof toDossierRecord }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { documentCountsOf, toDossierRecord } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("documentCountsOf", () => {
    it("finds the count of a category and reference whatever the composition of the accents, and zero for the rest", async () => {
        const subject = await buildSubject()
        const decomposed = `CAFE${String.fromCodePoint(0x301)}`
        const composed = `CAF${String.fromCodePoint(0xc9)}`
        const countOf = subject.documentCountsOf([{ topic: decomposed, ref: "1", documentCount: 6 }])

        expect(countOf(composed, "1")).toBe(6)
        expect(countOf(composed, "2")).toBe(0)
        expect(countOf("OTHER", "1")).toBe(0)
    })
})

describe("toDossierRecord", () => {
    it("carries the stored columns and the count of documents", async () => {
        const subject = await buildSubject()
        const row = dossierRowOf({
            id: "d3",
            ref: "3",
            position: 3,
            name: "Seal",
            status: "partial",
            drafts: "03. Decision.docx",
        })

        expect(subject.toDossierRecord(row, 2)).toEqual({
            id: "d3",
            ref: "3",
            category: "LEGAL FILES",
            categoryOrder: 1,
            position: 3,
            name: "Seal",
            status: "partial",
            existing: "Certificate",
            missing: null,
            drafts: "03. Decision.docx",
            documentCount: 2,
        })
    })
})
