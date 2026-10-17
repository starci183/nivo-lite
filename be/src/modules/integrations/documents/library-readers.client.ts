import type { DocumentFileReaders, DocumentFileTextResult } from "./documents.contracts"

/** Lazy library readers shared by document imports and table uploads. */
export const libraryReaders: DocumentFileReaders = {
    async docx(bytes: Uint8Array): Promise<string> {
        const mammoth = await import("mammoth")
        return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value
    },
    async pdf(bytes: Uint8Array): Promise<string> {
        return (await libraryReaders.pdfDetails(bytes)).text
    },
    async pdfDetails(bytes: Uint8Array): Promise<DocumentFileTextResult> {
        const { extractText, getDocumentProxy } = await import("unpdf")
        const pdf = await getDocumentProxy(new Uint8Array(bytes))
        const out = await extractText(pdf, { mergePages: true })
        return { text: out.text, pages: out.totalPages }
    },
}
