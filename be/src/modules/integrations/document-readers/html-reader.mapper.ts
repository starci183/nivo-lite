import type { DocumentTable } from "./document-readers.contracts"
import { cellText, sectionsOf, tableOf, tableText } from "./text-reader.mapper"
import type { DocumentSection, DocumentWarning } from "./document-readers.contracts"

/** The named characters a page commonly writes as entities. */
const NAMED: ReadonlyMap<string, string> = new Map([
    ["amp", "&"],
    ["lt", "<"],
    ["gt", ">"],
    ["quot", '"'],
    ["apos", "'"],
    ["nbsp", " "],
    ["ndash", "–"],
    ["mdash", "—"],
    ["hellip", "…"],
    ["laquo", "«"],
    ["raquo", "»"],
    ["copy", "©"],
])

/** Text with its HTML entities written out. */
export const decodeEntities = (text: string): string =>
    text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, body: string) => {
        if (body.startsWith("#x") || body.startsWith("#X"))
            return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
        if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10))
        return NAMED.get(body.toLowerCase()) ?? whole
    })

/** The text of an inline stretch of HTML: tags dropped, entities written out, spaces tidied. */
const inlineText = (html: string): string =>
    cellText(decodeEntities(html.replace(/<br\s*\/?>/giu, " ").replace(/<[^>]*>/gu, " ")))

/** The tag of a table placeholder, which no page text holds. */
const MARK = "\u0000"

/** A placeholder of a table already read. */
const PLACEHOLDER = new RegExp(`${MARK}(\\d+)${MARK}`, "gu")

/** A table already read, put back as the text of the cell that held it: its rows joined by semicolons. */
const nestedText = (html: string, tables: ReadonlyArray<DocumentTable>): string =>
    html.replace(PLACEHOLDER, (_whole, index: string) => {
        const table = tables[Number(index)]
        return table === undefined ? " " : ` ${tableText(table).replaceAll("\n", "; ")} `
    })

/** The rows of a table, cell by cell; a table nested in a cell becomes the text of that cell. */
const rowsOf = (table: string, tables: ReadonlyArray<DocumentTable>): Array<Array<string>> =>
    [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)].map((row) =>
        [...(row[1] ?? "").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/giu)].map((cell) =>
            inlineText(nestedText(cell[1] ?? "", tables)),
        ),
    )

/** What a page or a Word file turned into: its text, its headings and its tables. */
export interface HtmlText {
    /** The text: headings as Markdown headings, tables as one line per row, lists as dashes, paragraphs apart. */
    readonly text: string
    /** The headings and the text under each. */
    readonly sections: ReadonlyArray<DocumentSection>
    /** The tables. */
    readonly tables: ReadonlyArray<DocumentTable>
    /** The tables cut at the row limit. */
    readonly warnings: ReadonlyArray<DocumentWarning>
}

/**
 * The text of an HTML page or of the HTML a Word file turns into, shaped for the chunker: a heading becomes a Markdown heading (the
 * chunker cuts sections there), a table becomes one block of rows with its header first and cells joined by " | " (the chunker cuts it
 * by row, each passage carrying the header), list items become dashes, and blocks stand apart. Scripts, styles and comments are dropped.
 */
export const htmlText = (html: string): HtmlText => {
    const tables: Array<DocumentTable> = []
    const warnings: Array<DocumentWarning> = []
    let body = html
        .replace(/<!--[\s\S]*?-->/gu, "")
        .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/giu, "")
    // Innermost tables first: a table inside a cell becomes the text of its cell.
    for (let guard = 0; guard < 200 && /<table\b/iu.test(body); guard += 1) {
        body = body.replace(/<table\b[^>]*>((?:(?!<table\b)[\s\S])*?)<\/table>/giu, (_whole, inner: string) => {
            const made = tableOf(null, rowsOf(inner, tables))
            warnings.push(...made.warnings)
            if (made.table === null) return "\n\n"
            tables.push(made.table)
            return `\n\n${MARK}${tables.length - 1}${MARK}\n\n`
        })
        if (!/<table\b[^>]*>(?:(?!<table\b)[\s\S])*?<\/table>/iu.test(body)) break
    }
    const text = decodeEntities(
        body
            .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/giu, (_whole, level: string, inner: string) => {
                const heading = inlineText(inner)
                return heading === "" ? "\n\n" : `\n\n${"#".repeat(Number(level))} ${heading}\n\n`
            })
            .replace(/<li\b[^>]*>/giu, "\n- ")
            .replace(/<\/li>/giu, "")
            .replace(/<br\s*\/?>/giu, "\n")
            .replace(
                /<\/?(?:p|div|section|article|header|footer|main|aside|nav|ul|ol|dl|dt|dd|blockquote|pre|figure|figcaption|caption|form|fieldset)\b[^>]*>/giu,
                "\n\n",
            )
            .replace(/<[^>]*>/gu, " "),
    )
        .split("\n")
        .map((line) => line.replace(/[ \t ]+/gu, " ").trim())
        .join("\n")
        .replace(/\n{3,}/gu, "\n\n")
        .replace(PLACEHOLDER, (_whole, index: string) => {
            const table = tables[Number(index)]
            return table === undefined ? "" : tableText(table)
        })
        .trim()
    return { text, sections: sectionsOf(text), tables, warnings }
}
