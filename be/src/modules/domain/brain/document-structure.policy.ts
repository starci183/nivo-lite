/**
 * The structure of a document's text, by FORM only (no vocabulary): its line skeletons, its tables, its sections. The judgement of what
 * a block MEANS is the model's (`document-nature.policy.ts`).
 */

/** The share of a document's lines its most frequent skeleton must cover for the document to have a FORM. */
const FORM_SHARE = 0.3

/** The fewest lines the most frequent skeleton must have for a FORM (a pattern repeated, not two sentences that happen to match). */
const FORM_LINES = 5

/** How many of the most frequent skeletons name a form. */
const FORM_SKELETONS = 3

/** The skeleton of a line: every run of letters one `a`, every run of digits one `9`, spaces kept as one (format only, no vocabulary). */
const skeletonOf = (line: string): string =>
    line
        .trim()
        .replaceAll(/\p{L}+/gu, "a")
        .replaceAll(/\p{N}+/gu, "9")
        .replaceAll(/\s+/gu, " ")

/**
 * The FORM of a document: its file type and its three most frequent line skeletons, when the most frequent one repeats at least five times and covers at least 30 % of
 * its lines (a list or a template repeated line after line); null for prose. Two documents of one form were written to one pattern,
 * whatever their words and numbers.
 */
export const formOf = (fileType: string, texts: ReadonlyArray<string>): string | null => {
    const lines = texts.flatMap((text) => text.split("\n")).filter((line) => line.trim() !== "")
    if (lines.length === 0) return null
    const counts = new Map<string, number>()
    for (const line of lines) counts.set(skeletonOf(line), (counts.get(skeletonOf(line)) ?? 0) + 1)
    const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    const [top] = ranked
    if (top === undefined || top[1] < FORM_LINES || top[1] / lines.length < FORM_SHARE) return null
    return [fileType, ...ranked.slice(0, FORM_SKELETONS).map(([skeleton]) => skeleton)].join(" | ")
}

/** A text with its whitespace folded to single spaces, trimmed and lower-cased. */
const whitespaceFolded = (one: string): string => one.replaceAll(/\s+/gu, " ").trim().toLowerCase()

/** The quotes of an answer that the shown text holds (whitespace folded): evidence the model did not invent. */
export const evidenceIn = (quotes: ReadonlyArray<string>, texts: ReadonlyArray<string>): ReadonlyArray<string> => {
    const whole = whitespaceFolded(texts.join(" "))
    return quotes.map((quote) => quote.trim()).filter((quote) => quote !== "" && whole.includes(whitespaceFolded(quote))).slice(0, 3)
}

// ------------------------------------------------------------------ structure: tables and sections (form only, no vocabulary)

/** The delimiters a table may use, in the order they are tried. */
const DELIMITERS: ReadonlyArray<string> = ["\t", "|", ";", ","]

/** A markdown table's rule line (`|---|:--:|`). */
const RULE_LINE = /^[\s|:+-]+$/u

/** The fewest lines (header included) a block needs to be a table. */
const TABLE_LINES = 3

/** The share of a block's lines that must carry the same number of cells. */
const TABLE_SHARE = 0.8

/**
 * The cells of a line cut at one delimiter: a markdown row loses its outer bars; a comma or semicolon inside double quotes does not
 * cut (CSV quoting). Pure format.
 */
export const cellsOf = (line: string, delimiter: string): ReadonlyArray<string> => {
    const trimmed = line.trim()
    const body = delimiter === "|" ? trimmed.replace(/^\|/u, "").replace(/\|$/u, "") : trimmed
    const cells: Array<string> = []
    let current = ""
    let quoted = false
    for (const char of body) {
        if (char === '"' && delimiter !== "|") quoted = !quoted
        else if (char === delimiter && !quoted) {
            cells.push(current.trim())
            current = ""
        } else current += char
    }
    cells.push(current.trim())
    return cells
}

/** The shape of a block that is a table by its own form: its header line and its number of cells. */
export interface TableShape {
    /** The first line (the header the chunker repeats on every passage of the table). */
    readonly header: string
    /** The delimiter. */
    readonly delimiter: string
    /** The cells per row. */
    readonly columns: number
    /** The rows under the header. */
    readonly rows: ReadonlyArray<string>
}

/**
 * The table shape of a text, or null when it is not tabular by its form: at least three lines (a header and two rows), at least two
 * cells per row (three with a comma), and at least 80 % of the lines (the header among them) carrying the SAME number of cells on one delimiter. No id
 * shape, no vocabulary: a fee table and an order export are both tables; what each IS is the model's judgement (`tables` of the map).
 */
export const tableShapeOf = (text: string): TableShape | null => {
    const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "" && !RULE_LINE.test(line))
    const [header] = lines
    if (header === undefined || lines.length < TABLE_LINES) return null
    for (const delimiter of DELIMITERS) {
        const counts = lines.map((line) => cellsOf(line, delimiter).length)
        const columns = counts[0] ?? 0
        const same = counts.filter((count) => count === columns).length
        // A comma also writes prose and numbers: as the chunker does, a comma table has at least three cells.
        const fewest = delimiter === "," ? 3 : 2
        if (columns >= fewest && same / lines.length >= TABLE_SHARE) return { header, delimiter, columns, rows: lines.slice(1) }
    }
    return null
}

/** The key one table goes by: its header, spaces collapsed, case folded (the chunker repeats the same header on each of its passages). */
export const tableKeyOf = (header: string): string => header.replaceAll(/\s+/gu, " ").trim().toLowerCase().slice(0, 300)

/** A markdown heading mark opening a line. */
const HEADING = /^#{1,6}\s+\S/u

/** One section of a document: a run of passages from one that opens with a heading to the next (structure only). */
export interface Section {
    /** The index of its first passage. */
    readonly first: number
    /** The index of its last passage. */
    readonly last: number
    /** Its heading line, or its first words when it has none. */
    readonly head: string
    /** Its opening words after the heading (what a reader of the outline sees of it). */
    readonly opening: string
}

/** The most sections one map shows; more are joined in order into this many runs. */
export const MAX_SECTIONS = 150

/** The first non-empty line of a text. */
const firstLineOf = (text: string): string => text.split("\n").find((line) => line.trim() !== "")?.trim() ?? ""

/** The longest opening a section shows in the outline, in characters. */
export const OPENING_CHARS = 400

/** The words of a section after its heading line, on one line, cut (format only). */
const openingOf = (texts: ReadonlyArray<string>): string =>
    texts
        .join("\n")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "")
        .slice(1)
        .join(" ")
        .slice(0, OPENING_CHARS)

/**
 * The sections of a document, from its passages in order: a new section starts at a passage whose first line is a markdown heading
 * (the chunker never lets a passage cross one). A document with more than `MAX_SECTIONS` has neighbouring sections joined, in order.
 */
export const sectionsOf = (texts: ReadonlyArray<string>): ReadonlyArray<Section> => {
    const starts = texts.flatMap((text, index) => (index === 0 || HEADING.test(firstLineOf(text)) ? [index] : []))
    const raw = starts.map(
        (first, place): Section => ({
            first,
            last: (starts[place + 1] ?? texts.length) - 1,
            head: firstLineOf(texts[first] ?? "").slice(0, 120),
            opening: openingOf(texts.slice(first, (starts[place + 1] ?? texts.length))),
        }),
    )
    if (raw.length <= MAX_SECTIONS) return raw
    const size = Math.ceil(raw.length / MAX_SECTIONS)
    return Array.from({ length: Math.ceil(raw.length / size) }, (_, index) => {
        const run = raw.slice(index * size, index * size + size)
        const [head] = run
        // A joined run shows the opening of each section it joins, so no short section disappears from the outline.
        const opening = run.map((one) => `${one.head} ${one.opening}`).join(" | ").slice(0, OPENING_CHARS * 2)
        return { first: head?.first ?? 0, last: run.at(-1)?.last ?? 0, head: head?.head ?? "", opening }
    })
}

/** The index of the section a passage sits in. */
export const sectionIndexOf = (sections: ReadonlyArray<Section>, passage: number): number =>
    Math.max(
        0,
        sections.findIndex((section) => passage >= section.first && passage <= section.last),
    )
