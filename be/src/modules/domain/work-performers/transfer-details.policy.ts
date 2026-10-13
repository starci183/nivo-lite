/** The Vietnamese label of the bank details line, assembled from code points so the source stays ASCII. */
const VIETNAMESE_LABEL = ["th", 0xf4, "ng tin chuy", 0x1ec3, "n kho", 0x1ea3, "n"]
    .map((part) => (typeof part === "string" ? part : String.fromCodePoint(part)))
    .join("")

const DETAILS_LINE = new RegExp(
    `^\\s*[-*\\u2022]?\\s*(?:${VIETNAMESE_LABEL}|bank transfer details|payment details)\\s*[:\\uff1a]\\s*(.+?)\\s*$`,
    "iu",
)

/** The owner's bank transfer details: the text after the "bank transfer details" label (or its Vietnamese form), else null. */
export const transferDetailsOf = (knowledge: string | null | undefined): string | null => {
    for (const line of (knowledge ?? "").normalize("NFC").split(/\r?\n/u)) {
        const found = DETAILS_LINE.exec(line)?.[1]
        if (found !== undefined && found !== "") return found
    }
    return null
}
