/** A PDF by its file name or its content type. */
const isPdf = (name: string, contentType: string): boolean =>
    /\.pdf$/iu.test(name.trim()) || contentType.toLowerCase().startsWith("application/pdf")

/** Any letter of any script. */
const LETTER = /\p{L}/u

/**
 * Whether a PDF gave no words: a scan or a photographed page has no text layer, so the reader finds nothing, or only the page numbers and
 * marks of the print. Such a file is not empty, it needs OCR; a text of another kind of file that is empty is a different case.
 */
export const needsOcr = (name: string, contentType: string, text: string): boolean =>
    isPdf(name, contentType) && !LETTER.test(text)
