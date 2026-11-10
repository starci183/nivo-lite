import { ok, refused } from "@modules/platform/primitives"
import { DocumentRefusalCode } from "./document-readers.contracts"
import type { DocumentLibraries, DocumentReadOutcome } from "./document-readers.contracts"
import { isCompoundFile, isLockedOffice, isZip } from "./document-kind.policy"
import { htmlText } from "./html-reader.mapper"
import { presentationText, workbookText } from "./office-reader.mapper"

/** Why an Office file cannot be opened at all, or null when it is a zip archive to read: locked, old binary format, or not Office. */
const officeRefusal = (bytes: Uint8Array): DocumentRefusalCode | null => {
    if (isLockedOffice(bytes)) return DocumentRefusalCode.PasswordProtected
    if (isCompoundFile(bytes)) return DocumentRefusalCode.LegacyOffice
    return isZip(bytes) ? null : DocumentRefusalCode.Unreadable
}

/** A Word file: headings become Markdown headings, tables one row per line with their header, paragraphs apart. */
export const readWord = async (bytes: Uint8Array, libraries: DocumentLibraries): Promise<DocumentReadOutcome> => {
    const refusal = officeRefusal(bytes)
    if (refusal !== null) return refused(refusal)
    const html = await libraries.wordToHtml(bytes).catch(() => null)
    if (html === null) return refused(DocumentRefusalCode.Unreadable)
    const read = htmlText(html)
    return ok({
        reader: "docx",
        text: read.text,
        ...(read.sections.length > 0 ? { sections: read.sections } : {}),
        ...(read.tables.length > 0 ? { tables: read.tables } : {}),
        pageCount: null,
        sheetCount: null,
        transcribed: false,
        warnings: read.warnings,
    })
}

/** A workbook: each sheet one stretch, a table cut by row with its header. */
export const readWorkbook = (bytes: Uint8Array): DocumentReadOutcome => {
    const refusal = officeRefusal(bytes)
    if (refusal !== null) return refused(refusal)
    try {
        const read = workbookText(bytes)
        return ok({
            reader: "xlsx",
            text: read.pages.map((page) => page.text).join("\n\n"),
            pages: read.pages,
            tables: read.tables,
            pageCount: null,
            sheetCount: read.sheetCount,
            transcribed: false,
            warnings: read.warnings,
        })
    } catch {
        return refused(DocumentRefusalCode.Unreadable)
    }
}

/** A presentation: each slide one stretch. */
export const readSlides = (bytes: Uint8Array): DocumentReadOutcome => {
    const refusal = officeRefusal(bytes)
    if (refusal !== null) return refused(refusal)
    try {
        const read = presentationText(bytes)
        return ok({
            reader: "pptx",
            text: read.pages
                .map((page) => page.text)
                .filter((text) => text !== "")
                .join("\n\n"),
            pages: read.pages,
            pageCount: read.pages.length,
            sheetCount: null,
            transcribed: false,
            warnings: read.warnings,
        })
    } catch {
        return refused(DocumentRefusalCode.Unreadable)
    }
}
