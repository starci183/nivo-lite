import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { DocumentLibrarySdks } from "./documents.contracts"
import { libraryReadersOf } from "./library-readers.client"

const SUBJECT = Symbol("library-readers.client")

type Mammoth = Awaited<ReturnType<DocumentLibrarySdks["mammoth"]>>
type Unpdf = Awaited<ReturnType<DocumentLibrarySdks["unpdf"]>>

const sdksOf = () => {
    const mammoth = mock<Mammoth>()
    const unpdf = mock<Unpdf>()
    const sdks: DocumentLibrarySdks = {
        mammoth: jest.fn(() => Promise.resolve(mammoth)),
        unpdf: jest.fn(() => Promise.resolve(unpdf)),
    }
    return { sdks, mammoth, unpdf }
}

const build = async (sdks: DocumentLibrarySdks) => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => libraryReadersOf(sdks) }],
    }).compile()
    return moduleRef.get<ReturnType<typeof libraryReadersOf>>(SUBJECT)
}

describe("libraryReadersOf", () => {
    it("passes Word bytes to the lazy SDK and returns its text", async () => {
        const { sdks, mammoth } = sdksOf()
        const readers = await build(sdks)

        const bytes = new Uint8Array([80, 75])
        mammoth.extractRawText.mockResolvedValue({ value: "word", messages: [] })

        await expect(readers.docx(bytes)).resolves.toBe("word")
        expect(sdks.mammoth).toHaveBeenCalledTimes(1)
        expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: Buffer.from(bytes) })
    })

    it("keeps PDF pages for uploads and exposes merged text for document readers", async () => {
        const { sdks, unpdf } = sdksOf()
        const readers = await build(sdks)

        const bytes = new Uint8Array([37, 80, 68, 70, 45])
        const pdf = mock<Awaited<ReturnType<Unpdf["getDocumentProxy"]>>>()
        unpdf.getDocumentProxy.mockResolvedValue(pdf)
        unpdf.extractText.mockResolvedValue({ text: "pdf", totalPages: 7 })

        await expect(readers.pdfDetails(bytes)).resolves.toEqual({ text: "pdf", pages: 7 })
        await expect(readers.pdf(bytes)).resolves.toBe("pdf")
        expect(unpdf.getDocumentProxy).toHaveBeenCalledWith(bytes)
        expect(unpdf.getDocumentProxy.mock.calls[0]?.[0]).not.toBe(bytes)
        expect(unpdf.extractText).toHaveBeenCalledWith(pdf, { mergePages: true })
    })

    it("reads the pages of a PDF in one pass with the merged text the pdf reader gives", async () => {
        const { sdks, unpdf } = sdksOf()
        const readers = await build(sdks)

        const pdf = mock<Awaited<ReturnType<Unpdf["getDocumentProxy"]>>>()
        unpdf.getDocumentProxy.mockResolvedValue(pdf)
        unpdf.extractText
            .mockResolvedValueOnce({ text: "one\ntwo", totalPages: 2 })
            .mockResolvedValueOnce({ text: ["one", "two"], totalPages: 2 })

        await expect(readers.pdfPages(new Uint8Array([37]))).resolves.toEqual({
            text: "one\ntwo",
            pages: ["one", "two"],
        })
        expect(unpdf.getDocumentProxy).toHaveBeenCalledTimes(1)
        expect(unpdf.extractText).toHaveBeenNthCalledWith(1, pdf, { mergePages: true })
        expect(unpdf.extractText).toHaveBeenNthCalledWith(2, pdf, { mergePages: false })
    })

    it("propagates SDK errors for each consumer to map", async () => {
        const { sdks, mammoth, unpdf } = sdksOf()
        const readers = await build(sdks)

        const cause = new Error("locked")
        mammoth.extractRawText.mockRejectedValue(cause)
        unpdf.getDocumentProxy.mockRejectedValue(cause)

        await expect(readers.docx(new Uint8Array())).rejects.toBe(cause)
        await expect(readers.pdfDetails(new Uint8Array())).rejects.toBe(cause)
        await expect(readers.pdf(new Uint8Array())).rejects.toBe(cause)
    })
})
