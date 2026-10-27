/** The start of a SePay VietQR image link as the renewal tail writes it (vietQrUrl of channel-connections). */
const SEPAY_QR_PREFIX = "https://qr.sepay.vn/img?"

/** A character that ends a link inside a text. */
const LINK_END = /[\s<>"'`]/u

/** Punctuation that closes a sentence after a link and is not part of it. */
const TRAILING = new Set([".", ",", ";", ":", "!", "?", ")", "]"])

/** The link without the sentence punctuation that follows it. */
const withoutTrailing = (link: string): string => {
    let end = link.length
    while (end > 0 && TRAILING.has(link.charAt(end - 1))) end -= 1
    return link.slice(0, end)
}

/** The first SePay QR image link in a message text, or null when the text carries none. */
export const sepayQrUrlOf = (text: string): string | null => {
    const start = text.indexOf(SEPAY_QR_PREFIX)
    if (start < 0) return null
    const rest = text.slice(start)
    const end = rest.search(LINK_END)
    const link = withoutTrailing(end < 0 ? rest : rest.slice(0, end))
    return link.length > SEPAY_QR_PREFIX.length ? link : null
}
