/** Replaces each nonempty angle-bracket run, retaining unmatched and empty brackets. */
const stripTags = (html: string): string => {
    const out: Array<string> = []
    let cursor = 0
    let start = html.indexOf("<")
    while (start >= 0) {
        const end = html.indexOf(">", start + 1)
        if (end < 0) break
        if (end === start + 1) {
            start = html.indexOf("<", end + 1)
            continue
        }
        out.push(html.slice(cursor, start), " ")
        cursor = end + 1
        start = html.indexOf("<", cursor)
    }
    out.push(html.slice(cursor))
    return out.join("")
}

/** The visible text of an HTML page: scripts and styles dropped, block ends as line breaks, tags removed, entities decoded. */
export const htmlToText = (html: string): string =>
    stripTags(
        html
            .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/giu, " ")
            .replace(/<\/(p|div|li|h[1-6]|tr|br)>/giu, "\n")
            .replace(/<br\s*\/?>/giu, "\n"),
    )
        .replaceAll("&nbsp;", " ")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&#39;", "'")
        .replaceAll("&amp;", "&")
        .replace(/[ \t]+/gu, " ")
        .replace(/\n\s*\n+/gu, "\n\n")
        .trim()

/** The title of an HTML page, cut to 160 characters; null when it has none. */
export const pageTitle = (html: string): string | null => {
    const title = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(html)?.[1]
    return title === undefined ? null : htmlToText(title).slice(0, 160) || null
}
