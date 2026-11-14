/** The longest quote of a message above the composer, in characters. */
const QUOTE_MAX = 140

/** The words of a message on one line, cut to the bound with an ellipsis: what the composer quotes. */
export const quoteOf = (body: string): string => {
    const line = body.replaceAll(/\s+/gu, " ").trim()
    return line.length <= QUOTE_MAX ? line : `${line.slice(0, QUOTE_MAX - 1)}…`
}
