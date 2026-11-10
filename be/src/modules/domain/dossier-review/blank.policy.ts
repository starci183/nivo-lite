/**
 * Blanks left to fill in, as they read in a STORED passage. A stored passage is normalised first (`normalizeText` in knowledge-chunks
 * shortens every run of five or more dots, dashes or underscores to three), so a long dotted blank ("Price: ..........") reaches the rules as
 * "Price: ..." and a pattern of five dots never fires there. A run of three or four dots (or one ellipsis, or three underscores) therefore
 * counts as a blank when it stands on its own: after a start, a space, a colon or an opening parenthesis, and before an end, a space, a
 * closing parenthesis, a currency sign, a per cent sign or a comma. An ellipsis glued to a word ("etc...", "wait...") is prose, not a
 * blank. The raw five-dot form is kept for texts that were not normalised.
 */
const BLANKS: ReadonlyArray<RegExp> = [
    new RegExp(`…{2,}`, "gu"),
    /\.{5,}/gu,
    new RegExp(String.raw`(?<=^|[\s:(])(?:\.{3,4}|\u2026)(?=$|[\s),;%\u0111\u20ab])`, "gmu"),
    /(?<=^|[\s:(])_{3,}(?=$|[\s),;.%\u0111\u20ab])/gmu,
    new RegExp(String.raw`\[ ?(?:\.{3}|…)? ?\]`, "gu"),
    /\[_+\]/gu,
    /\[\d+(?:[.,]\d+)?\] ?%/gu,
]

/** Text a template leaves for the next shop: a bracketed or braced field name, a run of x, sample names. */
const TEMPLATE_TEXT: ReadonlyArray<RegExp> = [
    /\{\{[^}]{0,60}\}\}/gu,
    /<\s*(?:t[e\u00ea]n|s[o\u1ed1]|\u0111[i\u1ecb]a ch[i\u1ec9]|ng[a\u00e0]y|gi[a\u00e1]|name|shop)[^>]{0,40}>/giu,
    /\[\s*(?:t[e\u00ea]n|s[o\u1ed1]|\u0111[i\u1ecb]a ch[i\u1ec9]|ng[a\u00e0]y|gi[a\u00e1]|name|shop)[^\]]{0,40}\]/giu,
    /(?<![\p{L}\d])(?:xxx+|XXX+)(?![\p{L}\d])/gu,
    /lorem ipsum/giu,
    /(?:c[o\u00f4]ng ty|shop|c[u\u1eed]a h[a\u00e0]ng|ti[e\u1ec7]m)\s+ABC\b/giu,
]

/** One blank found in a text. */
export interface BlankMatch {
    /** Where it starts. */
    readonly index: number
    /** The blank as written. */
    readonly text: string
    /** A blank to fill in, or text a template left for another shop. */
    readonly kind: "blank" | "template"
}

const matchesOf = (text: string, patterns: ReadonlyArray<RegExp>, kind: BlankMatch["kind"]): Array<BlankMatch> =>
    patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => ({ index: match.index, text: match[0], kind })))

/** The blanks of a text in order, overlapping matches kept once (the first, longest wins). */
export const blanksIn = (text: string): ReadonlyArray<BlankMatch> => {
    const all = [...matchesOf(text, BLANKS, "blank"), ...matchesOf(text, TEMPLATE_TEXT, "template")].sort(
        (a, b) => a.index - b.index || b.text.length - a.text.length,
    )
    const kept: Array<BlankMatch> = []
    for (const match of all) {
        const last = kept.at(-1)
        if (last === undefined || match.index >= last.index + last.text.length) kept.push(match)
    }
    return kept
}

/** Only the blanks to fill in (no template text): what the dossier rule `signatures.placeholders` counts. */
export const fillBlanksIn = (text: string): ReadonlyArray<BlankMatch> =>
    blanksIn(text).filter((match) => match.kind === "blank")
