import { answers, keywordsOf } from "@modules/domain/knowledge-gaps"
import type { LessonCandidate } from "./lesson-candidates.contracts"

/** The longest question kept. */
export const QUESTION_MAX = 600

/** The longest answer kept. */
export const ANSWER_MAX = 1000

/** Two questions are the same gap when their words overlap this much (Jaccard) and share at least two words. Looser than the
 * customer-question gaps (0.65): the AI words each stop afresh, with codes and amounts that differ every time. */
const SAME_GAP = 0.5

/** Two answers say the same when their words overlap this much. */
const SAME_ANSWER = 0.6

/** A drafted value must be covered this much by the person's words: the draft never invents beyond them. */
export const DRAFT_COVERED = 0.6

const PHONE = /(?:\+?\d[\d .-]{7,}\d)/g
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
/** A run of eight digits or more (an order code, an account): never part of a shop rule. */
const LONG_DIGITS = /\d{8,}/

/** A text with phone numbers and e-mail addresses masked, spaces folded, cut to `max`. */
export const maskedOf = (text: string, max: number): string =>
    text.replace(EMAIL, "…").replace(PHONE, "…").replace(/\s+/g, " ").trim().slice(0, max)

/** Whether a text names one customer's data (a phone, an e-mail, a long code): such a text is no shop rule. */
export const namesCustomerData = (text: string): boolean => {
    const phone = new RegExp(PHONE.source)
    const email = new RegExp(EMAIL.source)
    return phone.test(text) || email.test(text) || LONG_DIGITS.test(text)
}

/** The significant words of a stop's question: the gap words without any token carrying a digit (codes and amounts differ every time). */
export const lessonWordsOf = (text: string): Array<string> => keywordsOf(text).filter((word) => !/\d/.test(word))

/** Jaccard overlap of two word lists, and how many words they share. */
const overlapOf = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): { readonly ratio: number; readonly shared: number } => {
    const known = new Set(b)
    const shared = a.filter((word) => known.has(word)).length
    const union = new Set([...a, ...b]).size
    return { ratio: union === 0 ? 1 : shared / union, shared }
}

/** Whether two stops of the same place are the same gap, judged by the words of their questions. Two questions with no word are the same. */
export const sameGap = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
    if (a.length === 0 && b.length === 0) return true
    const { ratio, shared } = overlapOf(a, b)
    return ratio >= SAME_GAP && shared >= Math.min(2, a.length, b.length)
}

/** Whether two answers say the same (normalised words). */
export const sameAnswer = (a: string, b: string): boolean => {
    const left = keywordsOf(a)
    const right = keywordsOf(b)
    if (left.length === 0 || right.length === 0) return left.length === right.length
    return overlapOf(left, right).ratio >= SAME_ANSWER
}

/** The group a new question joins among the recent candidates of its place (newest first): the nearest candidate's group, else none. */
export const groupOf = (recent: ReadonlyArray<LessonCandidate>, words: ReadonlyArray<string>): string | null =>
    recent.find((candidate) => sameGap(words, candidate.keywords))?.groupId ?? null

/** Whether a drafted value stays within the person's words: most of its significant words appear in them. */
export const withinWords = (value: string, said: ReadonlyArray<string>): boolean => {
    const words = keywordsOf(value)
    if (words.length === 0) return true
    const spoken = new Set(said.flatMap((text) => keywordsOf(text)))
    return answers(words, spoken, DRAFT_COVERED)
}

/** A date as the founder reads it (dd/mm). */
const dayOf = (iso: string): string => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

/** A quote cut for the reason line. */
const quoteOf = (text: string): string => `'${text.length > 200 ? `${text.slice(0, 199)}…` : text}'`

/**
 * The reason of a drafted truth, in plain Vietnamese, written by the engine (never by the model): how many times the founder was asked
 * about what, what they answered, and the proposal.
 */
export const learnedReasonOf = (topic: string, group: ReadonlyArray<LessonCandidate>): string => {
    const quotes = [...new Set(group.map((candidate) => candidate.answer))].map(quoteOf).join("; ")
    return `Đã hỏi chủ tiệm ${group.length} lần về ${topic}; chủ tiệm trả lời: ${quotes}; đề nghị ghi thành quy định để lần sau tự xử lý.`
}

/** The reason of a question card: the group's answers disagree; the newest one is put forward, the founder chooses. */
export const contradictionReasonOf = (
    topic: string,
    group: ReadonlyArray<LessonCandidate>,
    older: LessonCandidate,
    newer: LessonCandidate,
): string =>
    `Đã hỏi chủ tiệm ${group.length} lần về ${topic}, nhưng hai câu trả lời khác nhau: ${quoteOf(older.answer)} (${dayOf(older.answeredAt)}) và ` +
    `${quoteOf(newer.answer)} (${dayOf(newer.answeredAt)}). Chủ tiệm muốn ghi quy định nào? Đồng ý = ghi theo câu mới nhất; Không = vẫn hỏi từng lần.`
