import type { DocumentReaders } from "./documents.contracts"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"
import { pptxToText, xlsxToText } from "./ooxml.mapper"
import type { TextKind } from "./text-kind.policy"

/** The first bytes of a zip archive, which every Office file starts with. */
const isZip = (bytes: Uint8Array): boolean => bytes[0] === 0x50 && bytes[1] === 0x4b

/** The first bytes of a PDF. */
const isPdf = (bytes: Uint8Array): boolean => new TextDecoder("latin1").decode(bytes.subarray(0, 5)) === "%PDF-"

/** A byte order mark of UTF-16 (little or big endian). */
const utf16Of = (bytes: Uint8Array): "utf-16le" | "utf-16be" | null => {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le"
    return bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : null
}

/** The text of a plain-text file, in UTF-16 when it says so, else UTF-8 without its byte order mark. */
const decode = (bytes: Uint8Array): string => {
    const utf16 = utf16Of(bytes)
    return utf16 === null
        ? new TextDecoder("utf-8").decode(bytes).replace(/^\ufeff/u, "")
        : new TextDecoder(utf16).decode(bytes)
}

/**
 * Plain text of a file's bytes. A body that is not the kind its name says is `DOCUMENTS_FILE_INVALID`; a body of the right kind that
 * cannot be read (locked, damaged, a scan) is `DOCUMENTS_FILE_UNREADABLE`.
 */
export const textFromBytes = async (kind: TextKind, bytes: Uint8Array, readers: DocumentReaders): Promise<string> => {
    if (kind === "text") {
        if (bytes.subarray(0, 4096).includes(0) && utf16Of(bytes) === null) {
            throw new DocumentsError({ code: DocumentsErrorCode.FileInvalid, params: { kind } })
        }
        return decode(bytes)
    }
    if (kind === "pdf" ? !isPdf(bytes) : !isZip(bytes)) {
        throw new DocumentsError({ code: DocumentsErrorCode.FileInvalid, params: { kind } })
    }
    try {
        if (kind === "pdf") return await readers.pdf(bytes)
        if (kind === "docx") return await readers.docx(bytes)
        return kind === "xlsx" ? xlsxToText(bytes) : pptxToText(bytes)
    } catch (cause) {
        throw new DocumentsError({ code: DocumentsErrorCode.FileUnreadable, params: { kind }, cause })
    }
}
