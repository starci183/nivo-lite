import { keyOf } from "@modules/domain/brain-facts"

/** Words that carry no topic (question words, greetings, particles), in the accent-free form keyOf gives. */
const STOP: ReadonlySet<string> = new Set([
    "la",
    "co",
    "khong",
    "ko",
    "k",
    "the",
    "nao",
    "bao",
    "nhieu",
    "gi",
    "a",
    "ah",
    "nha",
    "nhe",
    "oi",
    "ban",
    "minh",
    "em",
    "anh",
    "chi",
    "shop",
    "cho",
    "hoi",
    "xin",
    "vay",
    "duoc",
    "voi",
    "va",
    "cua",
    "o",
    "tai",
    "nay",
    "kia",
    "do",
    "nhu",
    "de",
    "can",
    "muon",
    "biet",
    "ma",
    "thi",
    "ra",
    "sao",
    "nhi",
    "vui",
    "long",
    "ad",
    "admin",
    "cac",
    "nhung",
    "mot",
    "may",
    "bi",
    "rat",
    "se",
    "dang",
    "da",
    "con",
    "hay",
    "hoac",
    "xem",
    "giup",
    "tu",
    "van",
    "cam",
    "on",
    "chao",
    "ben",
    "phai",
    "kieu",
    "an",
    "is",
    "are",
    "does",
    "how",
    "what",
    "much",
    "many",
    "could",
    "i",
    "you",
    "your",
    "my",
    "me",
    "to",
    "of",
    "for",
    "in",
    "at",
    "and",
    "or",
    "it",
    "there",
    "any",
    "have",
    "has",
    "be",
    "was",
    "will",
    "would",
    "please",
    "hi",
    "hello",
    "when",
    "where",
    "which",
    "who",
    "with",
    "about",
    "this",
    "that",
])

/** Two questions ask the same thing when their word sets overlap this much (Jaccard) and share at least two words. */
const SAME_QUESTION = 0.65

/** A fact answers a gap when it covers this share of the question's words. */
export const FACT_ANSWERS = 0.6

/** A whole document is longer, so words appear by chance: it must cover more. */
export const DOC_ANSWERS = 0.75

/** The significant words of a text, unique, in order of appearance. */
export const keywordsOf = (text: string): Array<string> => [
    ...new Set(
        keyOf(text)
            .split("-")
            .filter((word) => word.length > 1 && !STOP.has(word)),
    ),
]

/** Whether two questions ask the same thing, judged by their significant words. */
export const sameQuestion = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
    if (a.length === 0 || b.length === 0) return false
    const known = new Set(b)
    const shared = a.filter((word) => known.has(word)).length
    const union = new Set([...a, ...b]).size
    return shared / union >= SAME_QUESTION && (shared >= 2 || union === 1)
}

/** The words of a text as a set, for coverage. */
export const wordSet = (text: string): Set<string> =>
    new Set(
        keyOf(text)
            .split("-")
            .filter((word) => word.length > 1),
    )

/** Whether a text covers `minimum` of the question's words, at least two of them (or the one word there is). */
export const answers = (question: ReadonlyArray<string>, text: ReadonlySet<string>, minimum: number): boolean => {
    const hits = question.filter((word) => text.has(word)).length
    return question.length > 0 && hits / question.length >= minimum && hits >= Math.min(2, question.length)
}

/** A topic guess split into the subject and the attribute the answer would be filed under. */
export interface TopicSplit {
    /** The subject, or null. */
    readonly subject: string | null
    /** The attribute, or null. */
    readonly attribute: string | null
}

/** A topic written "subject | attribute" becomes its two parts. */
export const splitTopic = (raw: string | null | undefined): TopicSplit => {
    const [subject, attribute] = (raw ?? "").split("|").map((part) => part.trim().slice(0, 120))
    return { subject: subject || null, attribute: attribute || null }
}
