import { Test } from "@nestjs/testing"
import { DOCUMENT_READERS_ERROR_KINDS, DocumentReadersError, DocumentReadersErrorCode } from "./errors/document-readers.error"
import { isLibraryMissing } from "./library-missing.policy"
import { DOCUMENT_READERS_MESSAGES } from "./messages/document-readers.messages"

const SUBJECT = Symbol("library-missing.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isLibraryMissing } }],
    }).compile()
    return moduleRef.get<typeof import("./library-missing.policy")>(SUBJECT)
}

describe("isLibraryMissing", () => {
    it("recognises the refusal for a missing library, with the package named in its params", async () => {
        const subject = await build()
        const missing = new DocumentReadersError({
            code: DocumentReadersErrorCode.LibraryMissing,
            params: { library: "heic-convert" },
        })

        expect(subject.isLibraryMissing(missing)).toBe(true)
        expect(missing.params).toEqual({ library: "heic-convert" })
    })

    it("recognises nothing else", async () => {
        const subject = await build()

        expect(subject.isLibraryMissing(new DocumentReadersError({ code: DocumentReadersErrorCode.NotWorkbook }))).toBe(false)
        expect(subject.isLibraryMissing(new RangeError("heic-convert is not installed"))).toBe(false)
    })
})

describe("the document-readers codes", () => {
    it("each has a kind and a Vietnamese and an English text", () => {
        for (const code of Object.values(DocumentReadersErrorCode)) {
            expect(DOCUMENT_READERS_ERROR_KINDS[code]).toBeDefined()
            expect(DOCUMENT_READERS_MESSAGES.vi).toHaveProperty([`errors.${code}`])
            expect(DOCUMENT_READERS_MESSAGES.en).toHaveProperty([`errors.${code}`])
        }
    })
})
