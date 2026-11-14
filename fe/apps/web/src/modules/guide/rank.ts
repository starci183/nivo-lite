import { normalize, wordsOf } from "./normalize"

/**
 * The guide search ranking, free of React and of the network. A query is cut into words; EVERY word must find something in the entry
 * (a miss on any word drops the entry), and the entry scores the mean of its words plus a bonus when the whole query leads a title or a
 * search phrase. One word scores against each word of a field:
 *
 * - the same word: 1;
 * - a prefix of the word ("sep" in "sepay"): 0.8, a little more the more of the word it spells;
 * - the initials of the field's words ("ckn" for "cap ket noi", at least two letters): 0.75;
 * - a near miss, one wrong, missing or extra letter, for a word of at least four letters: 0.55;
 * - inside the word, at least three letters: 0.45.
 *
 * Each score is weighted by the field it came from: the title 1, a search phrase 0.8, the hint 0.4. An entry whose mean is under
 * {@link MIN_SCORE} is not a result.
 */

/** The weight of each field of an entry. */
const TITLE_WEIGHT = 1
const KEYWORD_WEIGHT = 0.8
const HINT_WEIGHT = 0.4

/** The least mean score of a result. */
export const MIN_SCORE = 0.3

const NEAR_MISS_MIN_LENGTH = 4
const INSIDE_MIN_LENGTH = 3
const INITIALS_MIN_LENGTH = 2

/** An entry's texts, normalized once when the index is built. */
export interface GuideRankFields {
    readonly title: ReadonlyArray<string>
    readonly titleText: string
    readonly keywords: ReadonlyArray<ReadonlyArray<string>>
    readonly keywordTexts: ReadonlyArray<string>
    readonly hint: ReadonlyArray<string>
}

/** Reads an entry's texts once, so ranking never normalizes again. */
export const rankFieldsOf = (title: string, keywords: ReadonlyArray<string>, hint: string): GuideRankFields => ({
    title: wordsOf(title),
    titleText: normalize(title),
    keywords: keywords.map((entry) => wordsOf(entry)),
    keywordTexts: keywords.map((entry) => normalize(entry)),
    hint: wordsOf(hint),
})

/** Whether two words differ by at most one inserted, missing or changed letter. */
const isNear = (a: string, b: string): boolean => {
    if (Math.abs(a.length - b.length) > 1) return false
    let i = 0
    let j = 0
    let misses = 0
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            i += 1
            j += 1
            continue
        }
        misses += 1
        if (misses > 1) return false
        if (a.length > b.length) i += 1
        else if (a.length < b.length) j += 1
        else {
            i += 1
            j += 1
        }
    }
    return misses + (a.length - i) + (b.length - j) <= 1
}

/** How well one query word matches one word of a field, 0 to 1. */
const wordScore = (query: string, word: string): number => {
    if (query === word) return 1
    if (word.startsWith(query)) return 0.8 + 0.1 * (query.length / word.length)
    if (query.length >= NEAR_MISS_MIN_LENGTH && isNear(query, word.slice(0, query.length + 1))) return 0.55
    if (query.length >= INSIDE_MIN_LENGTH && word.includes(query)) return 0.45
    return 0
}

/** The best score of a query word over the words of one phrase and over the phrase's initials. */
const phraseScore = (query: string, words: ReadonlyArray<string>): number => {
    let best = 0
    for (const word of words) best = Math.max(best, wordScore(query, word))
    if (query.length >= INITIALS_MIN_LENGTH && words.length > 1) {
        const initials = words.map((word) => word.charAt(0)).join("")
        if (initials.startsWith(query)) best = Math.max(best, 0.75)
    }
    return best
}

/** The score of one query word against all the fields of an entry. */
const tokenScore = (query: string, fields: GuideRankFields): number => {
    let best = TITLE_WEIGHT * phraseScore(query, fields.title)
    for (const words of fields.keywords) best = Math.max(best, KEYWORD_WEIGHT * phraseScore(query, words))
    let hint = 0
    for (const word of fields.hint) hint = Math.max(hint, wordScore(query, word))
    return Math.max(best, HINT_WEIGHT * hint)
}

/** The bonus of a whole query that leads the title (or is it) or leads a search phrase. */
const phraseBonus = (text: string, fields: GuideRankFields): number => {
    if (fields.titleText === text) return 0.6
    if (fields.titleText.startsWith(text)) return 0.4
    return fields.keywordTexts.some((phrase) => phrase.startsWith(text)) ? 0.3 : 0
}

/** The score of an entry for a query, or 0 when it is not a result. A query without a word scores 0. */
export const scoreOf = (query: string, fields: GuideRankFields): number => {
    const text = normalize(query)
    const queryWords = wordsOf(text)
    if (queryWords.length === 0) return 0
    let total = 0
    for (const word of queryWords) {
        const score = tokenScore(word, fields)
        if (score === 0) return 0
        total += score
    }
    const mean = total / queryWords.length
    return mean < MIN_SCORE ? 0 : mean + phraseBonus(text, fields)
}
