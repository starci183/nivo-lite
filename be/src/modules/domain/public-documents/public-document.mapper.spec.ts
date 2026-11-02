import { Test } from "@nestjs/testing"
import { documentRow, documentSourceRow } from "@tests/fixtures/builders/public-documents.builder"
import { toPublicDocumentView } from "./public-document.mapper"

const SUBJECT = Symbol("public-document.mapper")
interface Subject {
    toPublicDocumentView: typeof toPublicDocumentView
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toPublicDocumentView } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const leftOut = [{ label: "Staff pay", reason: "salary" as const }]

describe("toPublicDocumentView", () => {
    it("shows the draft with its sources and what was left out", async () => {
        const subject = await buildSubject()
        const sources = [documentSourceRow({ sourceId: "s1" }), documentSourceRow({ sourceId: "s2" })]

        expect(subject.toPublicDocumentView(documentRow({ leftOut }), sources, new Set(["s2"]))).toEqual({
            id: "d1",
            title: "Frequent questions",
            body: "Same day delivery.",
            draftRevision: 0,
            publishedBody: null,
            status: "draft",
            kind: "drafted",
            question: null,
            gapId: null,
            sources: [
                { sourceId: "s1", title: "Delivery policy", changed: false },
                { sourceId: "s2", title: "Delivery policy", changed: true },
            ],
            leftOut,
            needsReview: true,
            hasPendingChange: false,
            approvedByName: null,
            approvedAt: null,
            failureCode: null,
            createdAt: "2026-11-01T01:00:00.000Z",
            updatedAt: "2026-11-01T02:00:00.000Z",
        })
    })

    it("shows who approved a published document and when, and a text changed since", async () => {
        const subject = await buildSubject()
        const published = documentRow({
            status: "published",
            publishedBody: "Delivery before 3 pm.",
            approvedBy: "u1",
            approvedByName: "Owner",
            approvedAt: new Date("2026-11-01T03:00:00.000Z"),
        })

        expect(subject.toPublicDocumentView(published, [documentSourceRow()], new Set())).toMatchObject({
            needsReview: false,
            hasPendingChange: true,
            approvedByName: "Owner",
            approvedAt: "2026-11-01T03:00:00.000Z",
        })
    })

    it.each(["drafting", "failed", "archived"] as const)("never asks for a review of a %s document", async (status) => {
        const subject = await buildSubject()

        expect(
            subject.toPublicDocumentView(documentRow({ status }), [documentSourceRow()], new Set(["s1"])).needsReview,
        ).toBe(false)
    })

    it("needs no review when no source changed, and a document with no source cannot change", async () => {
        const subject = await buildSubject()
        const published = documentRow({ status: "published" })

        expect(subject.toPublicDocumentView(published, [documentSourceRow()], new Set()).needsReview).toBe(false)
        expect(subject.toPublicDocumentView(documentRow({ kind: "written" }), [], new Set(["s9"])).needsReview).toBe(
            false,
        )
    })
})
