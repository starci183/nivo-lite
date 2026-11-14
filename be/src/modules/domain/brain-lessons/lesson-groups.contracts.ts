import type { LessonCandidate, LessonFactKey } from "./lesson-candidates.contracts"

/** A group the model read as one decision of the founder, said again: a truth to propose, resting on the answers it names. */
export interface LessonGroupLesson {
    /** Marks a drafted truth. */
    readonly kind: "lesson"
    /** Every answer of the group, oldest first. */
    readonly items: ReadonlyArray<LessonCandidate>
    /** The answers the truth rests on (named by the model, each an answer of the group), oldest first. */
    readonly restsOn: ReadonlyArray<LessonCandidate>
    /** The truth, as people write it. */
    readonly factKey: LessonFactKey
    /** A short phrase of what was asked. */
    readonly topic: string
    /** The value in the store's one value + unit form; the founder's own words. */
    readonly value: string
    /** Its unit apart, or null. */
    readonly unit: string | null
    /** The day the rule ends when the founder stated one (YYYY-MM-DD), else null. */
    readonly validTo: string | null
}

/** A group the model read as answers that contradict each other: a question card on exactly these answers. */
export interface LessonGroupContradiction {
    /** Marks a contradiction. */
    readonly kind: "contradiction"
    /** The free answers of the group (status candidate), oldest first: the card stands on exactly these. */
    readonly items: ReadonlyArray<LessonCandidate>
    /** The truth the answers are about. */
    readonly factKey: LessonFactKey
    /** A short phrase of what was asked. */
    readonly topic: string
}

/** An agreeing group with an answer the founder turned down before: the same decision again, so its free answers are declined too. */
export interface LessonGroupDeclined {
    /** Marks a decision turned down before. */
    readonly kind: "declined"
    /** The free answers of the group (status candidate) to decline. */
    readonly items: ReadonlyArray<LessonCandidate>
}

/** A group with an answer already on an open card: the founder decides that card first, nothing moves. */
export interface LessonGroupWaiting {
    /** Marks a group waiting on an open card. */
    readonly kind: "waiting"
    /** Every answer of the group. */
    readonly items: ReadonlyArray<LessonCandidate>
}

/** What one group of the model's answer comes to, once its integrity is checked. */
export type LessonGroupReading = LessonGroupLesson | LessonGroupContradiction | LessonGroupDeclined | LessonGroupWaiting

/** Why a group of the model's answer was dropped (structure only: never what its words mean). */
export type LessonGroupDropReason =
    | "malformed"
    | "unknown_item"
    | "item_in_two_groups"
    | "too_few_answers"
    | "rests_outside_group"
    | "no_lesson"
    | "not_shop_words"
    | "customer_data"
    | "value_not_said"

/** A group of the model's answer that was dropped, with the item numbers it named and why. */
export interface LessonGroupDropped {
    /** The item numbers the group named, as the model wrote them (integers only). */
    readonly numbers: ReadonlyArray<number>
    /** Why it was dropped. */
    readonly why: LessonGroupDropReason
}

/** The groups one draft call answered: those that passed the integrity checks, and those dropped. */
export interface LessonGroupsRead {
    /** The groups that passed, in the model's order. */
    readonly readings: ReadonlyArray<LessonGroupReading>
    /** The groups dropped, in the model's order. */
    readonly dropped: ReadonlyArray<LessonGroupDropped>
}

/** The groups of a draft answer, or null when the answer is not the expected JSON (a failed try). */
export type MaybeLessonGroupsRead = LessonGroupsRead | null

/** A check of one group: what it comes to, or why it is dropped. */
export type LessonGroupJudged<Value> =
    { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly why: LessonGroupDropReason }
