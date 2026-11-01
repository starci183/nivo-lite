import type {
    DocumentFileReaders,
    DocumentFileTextResult,
    DocumentLibrarySdks,
    PdfPagesResult,
} from "./documents.contracts"

/** Word and PDF readers over the given SDKs, shared by document imports and table uploads. */
export const libraryReadersOf = (sdks: DocumentLibrarySdks): DocumentFileReaders => {
    const readers: DocumentFileReaders = {
        async docx(bytes: Uint8Array): Promise<string> {
            const mammoth = await sdks.mammoth()
            return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value
        },
        async pdf(bytes: Uint8Array): Promise<string> {
            return (await readers.pdfDetails(bytes)).text
        },
        async pdfPages(bytes: Uint8Array): Promise<PdfPagesResult> {
            const { extractText, getDocumentProxy } = await sdks.unpdf()
            const pdf = await getDocumentProxy(new Uint8Array(bytes))
            const merged = await extractText(pdf, { mergePages: true })
            const pages = await extractText(pdf, { mergePages: false })
            return { text: merged.text, pages: pages.text }
        },
        async pdfDetails(bytes: Uint8Array): Promise<DocumentFileTextResult> {
            const { extractText, getDocumentProxy } = await sdks.unpdf()
            const pdf = await getDocumentProxy(new Uint8Array(bytes))
            const out = await extractText(pdf, { mergePages: true })
            return { text: out.text, pages: out.totalPages }
        },
    }
    return readers
}
