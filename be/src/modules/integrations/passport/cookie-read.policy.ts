/** The value of one cookie in a `Cookie` request header (empty text when the header lacks it); the values we write are URL-safe and need no decoding. */
export const cookieValue = (header: string, name: string): string => {
    for (const part of header.split(";")) {
        const separator = part.indexOf("=")
        if (separator > 0 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim()
    }
    return ""
}
