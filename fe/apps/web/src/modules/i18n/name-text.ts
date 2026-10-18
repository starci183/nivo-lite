/** Replaces each opening parenthesis through the next closing one, leaving an unmatched tail intact. */
export const withoutParentheses = (text: string): string => {
    const parts: Array<string> = []
    let at = 0
    let open = text.indexOf("(", at)
    while (open !== -1) {
        const close = text.indexOf(")", open + 1)
        if (close === -1) break
        parts.push(text.slice(at, open), " ")
        at = close + 1
        open = text.indexOf("(", at)
    }
    parts.push(text.slice(at))
    return parts.join("")
}
