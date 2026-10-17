import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import mammoth from "mammoth"
import unpdf from "unpdf"
import { libraryReaders } from "./library-readers.client"

const SUBJECT = Symbol("library-readers.client")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => ({ libraryReaders }) }],
    }).compile()
    return moduleRef.get<Pick<typeof import("./library-readers.client"), "libraryReaders">>(SUBJECT)
}

describe("libraryReaders", () => {
    afterEach(() => jest.restoreAllMocks())

    it("passes Word bytes to the lazy SDK and returns its text", async () => {
        const subject = await build()

        const bytes = new Uint8Array([80, 75])
        const extract = jest.spyOn(mammoth, "extractRawText").mockResolvedValue({ value: "word", messages: [] })

        await expect(subject.libraryReaders.docx(bytes)).resolves.toBe("word")
        expect(extract).toHaveBeenCalledWith({ buffer: Buffer.from(bytes) })
    })

    it("keeps PDF pages for uploads and exposes merged text for document readers", async () => {
        const subject = await build()

        const bytes = new Uint8Array([37, 80, 68, 70, 45])
        const pdf = mock<Awaited<ReturnType<typeof unpdf.getDocumentProxy>>>()
        const proxy = jest.spyOn(unpdf, "getDocumentProxy").mockResolvedValue(pdf)
        const extract = jest.spyOn(unpdf, "extractText").mockResolvedValue({ text: "pdf", totalPages: 7 })

        await expect(subject.libraryReaders.pdfDetails(bytes)).resolves.toEqual({ text: "pdf", pages: 7 })
        await expect(subject.libraryReaders.pdf(bytes)).resolves.toBe("pdf")
        expect(proxy).toHaveBeenCalledWith(bytes)
        expect(proxy.mock.calls[0]?.[0]).not.toBe(bytes)
        expect(extract).toHaveBeenCalledWith(pdf, { mergePages: true })
    })

    it("propagates SDK errors for each consumer to map", async () => {
        const subject = await build()

        const cause = new Error("locked")
        jest.spyOn(mammoth, "extractRawText").mockRejectedValue(cause)
        jest.spyOn(unpdf, "getDocumentProxy").mockRejectedValue(cause)

        await expect(subject.libraryReaders.docx(new Uint8Array())).rejects.toBe(cause)
        await expect(subject.libraryReaders.pdfDetails(new Uint8Array())).rejects.toBe(cause)
        await expect(subject.libraryReaders.pdf(new Uint8Array())).rejects.toBe(cause)
    })
})
