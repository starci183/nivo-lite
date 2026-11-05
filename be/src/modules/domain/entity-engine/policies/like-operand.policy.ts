/** The escape character of a LIKE pattern is the backslash: it, the percent sign and the underscore stand for themselves. */
const LIKE_SPECIALS = /[\\%_]/g

/** The LIKE operand of a "contains" search: the text with its pattern characters escaped, between percent signs. */
export const likeContains = (text: string): string => {
    const escaped = text.replace(LIKE_SPECIALS, String.raw`\$&`)
    return `%${escaped}%`
}
