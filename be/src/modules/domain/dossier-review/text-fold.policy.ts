/** The lower-case, accent-free form of a text with one character per input character, so an index into it is an index into the original (NFC) text. */
export const foldKeepLength = (text: string): string =>
    text
        .split("")
        .map((unit) => unit.toLowerCase().replace("\u0111", "d").normalize("NFD").charAt(0))
        .join("")

/** The folded form of any text: NFC, accents removed, lower case, whitespace collapsed to single spaces. */
export const foldText = (text: string): string => foldKeepLength(text.normalize("NFC")).replaceAll(/\s+/gu, " ").trim()
