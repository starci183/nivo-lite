/**
 * The words of a passage search as the RANKED word leg reads them. The caller (an agent, a founder) passes the KEY WORDS of what it looks
 * for, as a document would write them ("SP-0015 chieu cao", "mau don nu khep"); a passage ranks by how much of them it holds, a code or a
 * number weighing more than a word, so a passage holding only some of the words is still found. There is no list of words to drop: a
 * word the documents do not hold (a question word the caller left in) simply holds nothing, and the search result tells the caller to
 * search again with the document's own words. Only what decides the SQL is computed here: the text of each term still goes to the
 * database as it was written, which folds and cuts it exactly as it did the passage.
 */

/** One term of a ranked search. */
export interface WordTerm {
    /** The term as the reader wrote it (edge punctuation off); the database folds and parses it. */
    readonly text: string
    /** What holding it is worth: `CODE_WEIGHT` for a code or a number of three or more characters, else 1. */
    readonly weight: number
}

/** The terms of a ranked search. */
export interface WordTerms {
    /** The terms a passage scores by, codes first, at most `TERMS_MAX`. */
    readonly terms: ReadonlyArray<WordTerm>
    /** Quoted phrases (`"..."`): each must appear as written. */
    readonly phrases: ReadonlyArray<string>
    /** Excluded words (`-word`): a passage holding one is no hit. */
    readonly excluded: ReadonlyArray<string>
}

/** What holding a code or a long number is worth against one word: it outranks a passage that only holds two other words. */
export const CODE_WEIGHT = 3

/** The most terms one search scores by (the candidate condition then has at most 140 groups, `candidateGroupsOf`). */
export const TERMS_MAX = 8

/** True for a letter or a digit. */
const isWordChar = (char: string): boolean => /[\p{L}\p{N}]/u.test(char)

/** A word without the punctuation at its edges (`cm?` -> `cm`, `(SP-0015)` -> `SP-0015`); linear, no backtracking pattern. */
const bare = (word: string): string => {
    const chars = [...word]
    const start = chars.findIndex((char) => isWordChar(char))
    if (start < 0) return ""
    const end = chars.findLastIndex((char) => isWordChar(char))
    return chars.slice(start, end + 1).join("")
}

/** True for a code or a number worth more than a word: a digit and three characters or more, or a digit beside a letter. */
export const isCodeLike = (word: string): boolean =>
    /\p{N}/u.test(word) && (word.length >= 3 || /\p{L}/u.test(word))

/**
 * True for a code that names one thing (`SP-0015`, `DH-2026-012346`, an account or phone number): letters and digits of five
 * characters or more, or seven digits or more. It alone makes a candidate. A date, a price, a branch code (`CN2`) is code-like
 * (it weighs more) but not selective: thousands of rows of a stock sheet share one date, so it only counts with the words.
 */
export const isNamingCode = (word: string): boolean =>
    (/\p{L}/u.test(word) && /\p{N}/u.test(word) && word.length >= 5) || /^\p{N}{7,}$/u.test(word)

/**
 * The terms of a query in web-search syntax: `"a phrase"` must appear, `-word` excludes, `or` is no term (every term already counts
 * on its own), each term once (case aside), in the order of the query,
 * at most `TERMS_MAX` (code-like terms kept first when there are more). A term without a letter or a digit is no term.
 */
export const wordTermsOf = (query: string): WordTerms => {
    const phrases = [...query.matchAll(/"([^"]*)"/gu)].map((found) => (found[1] ?? "").trim()).filter((phrase) => /[\p{L}\p{N}]/u.test(phrase))
    const loose = query.replaceAll(/"[^"]*"?/gu, " ").split(/\s+/u).filter((word) => word !== "")
    const excluded = loose.filter((word) => /^-[\p{L}\p{N}]/u.test(word)).map((word) => bare(word.slice(1))).filter((word) => word !== "")
    const words = loose
        .filter((word) => !/^-[\p{L}\p{N}]/u.test(word))
        .map((word) => bare(word))
        .filter((word) => word !== "" && word.toLowerCase() !== "or")
    // Each word once as written (case aside): two words that only fold alike (mua / mua with other marks) stay two terms, so a phrase of
    // them ("mua mua", the rainy season) is still asked side by side.
    const seen = new Set<string>()
    const unique = words.filter((word) => {
        const key = word.normalize("NFC").toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
    const weighed = unique.map((text): WordTerm => ({ text, weight: isCodeLike(text) ? CODE_WEIGHT : 1 }))
    const kept = new Set(
        weighed
            .map((term, at) => ({ term, at }))
            .toSorted((left, right) => right.term.weight - left.term.weight || left.at - right.at)
            .slice(0, TERMS_MAX)
            .map((entry) => entry.at),
    )
    return { terms: weighed.filter((_, at) => kept.has(at)), phrases, excluded }
}

/** The most a passage can score by the terms: every term held. */
export const totalWeightOf = (terms: ReadonlyArray<WordTerm>): number => terms.reduce((sum, term) => sum + term.weight, 0)

/** Every way to pick `count` items of a list, in the list's order. */
const picksOf = <Item>(items: ReadonlyArray<Item>, count: number): ReadonlyArray<ReadonlyArray<Item>> =>
    count <= 0
        ? [[]]
        : items.flatMap((item, at) => picksOf(items.slice(at + 1), count - 1).map((rest) => [item, ...rest]))

/**
 * A group a candidate passage may satisfy: every RUN of it must stand in the passage, a run of one term anywhere, a run of two terms
 * side by side in this order (a phrase). Term positions index `WordTerms.terms`.
 */
export type CandidateGroup = ReadonlyArray<ReadonlyArray<number>>

/**
 * The groups a candidate passage must satisfy one of. The condition decides how many passages the statement ranks, so it is as narrow
 * as a question allows without losing the passage that answers it (measured offline on the 19.8 MB test corpus, 27,174 passages):
 * - a query that holds a naming code (`isNamingCode`): every such code alone; its other words only rank;
 * - one other term: that term;
 * - else two neighbouring terms of the query side by side (Vietnamese words are often two syllables: "mau don", "cam tu") with at
 *   least half of the remaining terms anywhere (one at least): a question of several words never reads the passages that only share
 *   one common word or one common pair with it ("hoa" is in every passage of a flower shop, "giay goi" in every product text).
 * At most 7 runs times 20 picks = 140 groups for `TERMS_MAX` terms.
 */
export const candidateGroupsOf = (terms: ReadonlyArray<WordTerm>): ReadonlyArray<CandidateGroup> => {
    const codes = terms.flatMap((term, at) => (isNamingCode(term.text) ? [[[at]]] : []))
    if (codes.length > 0) return codes
    const plain = terms.flatMap((_, at) => [at])
    if (plain.length <= 1) return plain.map((at) => [[at]])
    const need = Math.max(1, Math.ceil((plain.length - 2) / 2))
    return plain.slice(0, -1).flatMap((first, index): ReadonlyArray<CandidateGroup> => {
        const second = plain[index + 1] ?? first
        const others = plain.filter((at) => at !== first && at !== second)
        if (others.length === 0) return [[[first, second]]]
        return picksOf(others, Math.min(need, others.length)).map((pick) => [[first, second], ...pick.map((at) => [at])])
    })
}
