import type { DocumentFile, DocumentReadOutcome, ReadOptions } from "./document-readers.contracts"

/** The document readers port: any kind of shop document becomes clean, located text, or a refusal that says why. */
export interface DocumentReadersPort {
    /** True when a file name can be taken at the upload door: a kind a reader exists for, an old Office file (refused with its reason), or no extension. */
    acceptsName(name: string): boolean
    /**
     * The text of a file. Text, Markdown, CSV/TSV, HTML, a PDF with a text layer, Word, Excel and PowerPoint are read by code; a
     * picture, and each page of a PDF that has no text layer, goes through `options.transcriber` as one call per page.
     */
    read(file: DocumentFile, options: ReadOptions): Promise<DocumentReadOutcome>
}
