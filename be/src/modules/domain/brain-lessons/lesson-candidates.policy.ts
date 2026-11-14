import { valueFormOf, valueLineOf } from "@modules/domain/brain-facts"
import type { LessonCandidate } from "./lesson-candidates.contracts"
import { LESSON_REASON_COPY } from "./messages/brain-lessons.messages"

/** The longest question kept. */
export const QUESTION_MAX = 600

/** The longest answer kept. */
export const ANSWER_MAX = 1000

const PHONE = /(?:\+?\d[\d .-]{7,}\d)/g
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
/** A run of eight digits or more (an order code, an account): never part of a shop rule. */
const LONG_DIGITS = /\d{8,}/

/** A text with phone numbers and e-mail addresses masked, spaces folded, cut to `max`. */
export const maskedOf = (text: string, max: number): string =>
    text.replaceAll(EMAIL, "…").replaceAll(PHONE, "…").replaceAll(/\s+/g, " ").trim().slice(0, max)

/** Whether a text names one customer's data (a phone, an e-mail, a long code): such a text is no shop rule. */
export const namesCustomerData = (text: string): boolean => {
    const phone = new RegExp(PHONE.source)
    const email = new RegExp(EMAIL.source)
    return phone.test(text) || email.test(text) || LONG_DIGITS.test(text)
}

/**
 * The shapes of the engine's own identifiers: a NIVO tool id (`nivo.tool.payment.transfer.create`), a uuid (a run, a step's record, a change), a
 * snake_case key (`order_has_money`, `already_told_for_this_stop`) and an engine ref (`run:…`, `step:…`, `brain-change:…`). Never a word
 * of a shop rule.
 */
const INTERNAL_IDS: ReadonlyArray<RegExp> = [
    /\bnivo\.[a-z][\w.-]*/iu,
    /\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/iu,
    /\b[a-z][a-z\d]*_[a-z\d_]+\b/u,
    /\b(?:run|step|stop|brain-change|fact|lesson|wake):[\w-]+/iu,
]

/** Whether a text carries an identifier of the engine (a tool id, a uuid, a snake_case key, an engine ref): such a text is no shop rule. */
export const namesInternalIds = (text: string): boolean => INTERNAL_IDS.some((shape) => shape.test(text))

/** Whether a text is nothing but identifiers and separators once they are taken out. */
export const onlyIdentifiers = (text: string): boolean =>
    INTERNAL_IDS.reduce((left, shape) => left.replaceAll(new RegExp(shape.source, "giu"), " "), text)
        .replaceAll(/[\s\p{P}\p{S}]+/gu, "")
        .trim() === ""

/**
 * Whether a drafted text may stand in a lesson: words of the shop, never an identifier of the engine (shapes of ids only). No code
 * reads a text for whether it addresses an AI (owner 2026-11-12: no word list decides what a text means); a lesson is a proposal a
 * person approves, drafted by a model that is told its material is data.
 */
export const lessonTextOk = (text: string): boolean =>
    text.trim() !== "" && !namesInternalIds(text) && !onlyIdentifiers(text)

/** A drafted value with its unit, as a lesson proposes it. */
export interface LessonValue {
    /** The value. */
    readonly value: string
    /** Its unit apart, or null. */
    readonly unit: string | null
}

/**
 * A drafted value in the store's ONE normal form of a value and its unit (`valueLineOf`, the form every truth door writes; `valueFormOf`,
 * the form values are compared in), so a lesson never shows a stray unit. A measured value (money, a number, a share, a span or a length
 * of time, once read with its unit) keeps its unit apart. A rule in words keeps a unit only for the number it ends with (a fee rule
 * ending "8" with "%" reads "8 %"); any other unit the draft gave a rule in words is not the rule's (live D-MX-8: a dong sign after a
 * sentence) and is dropped.
 */
export const lessonValueOf = (drafted: LessonValue): LessonValue => {
    const text = drafted.value.trim()
    const apart = drafted.unit?.trim() ?? ""
    if (apart === "") return { value: text, unit: null }
    const line = valueLineOf({ value: text, unit: apart })
    if (valueFormOf(line).type !== "text") return { value: text, unit: apart }
    return { value: /\d$/u.test(text) ? line : text, unit: null }
}

/** A date as the founder reads it (dd/mm). */
const dayOf = (iso: string): string => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

/** A quote cut for the reason line. */
const quoteOf = (text: string): string => {
    const shown = text.length > 200 ? `${text.slice(0, 199)}…` : text
    return `'${shown}'`
}

/**
 * The reason of a drafted truth, in plain Vietnamese, written by the engine (never by the model): how many times the founder was asked
 * about what, what they answered, and the proposal.
 */
export const learnedReasonOf = (topic: string, group: ReadonlyArray<LessonCandidate>): string => {
    const quotes = [...new Set(group.map((candidate) => candidate.answer))].map((answer) => quoteOf(answer)).join("; ")
    return LESSON_REASON_COPY.learned(group.length, topic, quotes)
}

/** The reason of a question card: the group's answers disagree; the newest one is put forward, the founder chooses. */
export const contradictionReasonOf = (
    topic: string,
    group: ReadonlyArray<LessonCandidate>,
    older: LessonCandidate,
    newer: LessonCandidate,
): string =>
    LESSON_REASON_COPY.contradiction({
        asked: group.length,
        topic,
        older: quoteOf(older.answer),
        olderDay: dayOf(older.answeredAt),
        newer: quoteOf(newer.answer),
        newerDay: dayOf(newer.answeredAt),
    })
