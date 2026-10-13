/** The visible text of an HTML page: scripts and styles dropped, block ends as line breaks, tags removed, entities decoded. */
export const htmlToText = (html: string): string =>
    html
        .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/giu, " ")
        .replace(/<\/(p|div|li|h[1-6]|tr|br)>/giu, "\n")
        .replace(/<br\s*\/?>/giu, "\n")
        .replace(/<[^>]+>/gu, " ")
        .replace(/&nbsp;/gu, " ")
        .replace(/&lt;/gu, "<")
        .replace(/&gt;/gu, ">")
        .replace(/&quot;/gu, '"')
        .replace(/&#39;/gu, "'")
        .replace(/&amp;/gu, "&")
        .replace(/[ \t]+/gu, " ")
        .replace(/\n\s*\n+/gu, "\n\n")
        .trim()

/** The title of an HTML page, cut to 160 characters; null when it has none. */
export const pageTitle = (html: string): string | null => {
    const title = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(html)?.[1]
    return title === undefined ? null : htmlToText(title).slice(0, 160) || null
}
