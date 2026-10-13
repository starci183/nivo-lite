// The Vietnamese label the owner writes in the business notes is spelled with escapes to keep the source ASCII.
const LABEL = "thông tin chuyển khoản"
const DETAILS_LINE = new RegExp(
    `^\\s*[-*\\u2022]?\\s*(?:${LABEL}|bank transfer details|payment details)\\s*[:\\uff1a]\\s*(.+?)\\s*$`,
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
