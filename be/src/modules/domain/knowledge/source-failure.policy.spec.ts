import { Test } from "@nestjs/testing"
import { DocumentsError, DocumentsErrorCode } from "@modules/integrations/documents"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode, StoredNote } from "@modules/domain/knowledge-sources"
import { failureOf } from "./source-failure.policy"

const SUBJECT = Symbol("source-failure.policy")
type Subject = { failureOf: typeof failureOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { failureOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("failureOf", () => {
    it("keeps the code of a documents error and says whether it is worth another try", async () => {
        const subject = await build()

        expect(subject.failureOf(new DocumentsError({ code: DocumentsErrorCode.NotPublic }))).toEqual({
            note: "DOCUMENTS_NOT_PUBLIC",
            transient: false,
        })
        expect(subject.failureOf(new DocumentsError({ code: DocumentsErrorCode.Unavailable }))).toEqual({
            note: "DOCUMENTS_UNAVAILABLE",
            transient: true,
        })
    })

    it("keeps the code of a sources error, worth another try when storage was unreachable", async () => {
        const subject = await build()

        expect(
            subject.failureOf(new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.UploadUnavailable })),
        ).toEqual({
            note: "KNOWLEDGE_SOURCES_UPLOAD_UNAVAILABLE",
            transient: true,
        })
        expect(
            subject.failureOf(new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })),
        ).toEqual({
            note: "KNOWLEDGE_SOURCES_NOT_FOUND",
            transient: false,
        })
    })

    it("takes any other failure for unreadable, and a network one for transient", async () => {
        const subject = await build()

        expect(subject.failureOf(new Error("boom"))).toEqual({ note: StoredNote.Unreadable, transient: false })
        expect(subject.failureOf(new TypeError("fetch failed"))).toEqual({
            note: StoredNote.Unreadable,
            transient: true,
        })
    })
})
