import type { LessonCandidateStatus, LessonCandidateThen } from "./persistence/entities"

export type { LessonCandidateStatus, LessonCandidateThen }

/** Where a stop happened: the agent, its workflow and the step. A group of candidates never crosses places. */
export interface LessonPlace {
    /** The agent that asked. */
    readonly agentId: string
    /** The workflow, or null for an agent's own graph. */
    readonly workflowId: string | null
    /** The step that stopped. */
    readonly stepKey: string
}

/** The key of a truth as the brain.change card names it. */
export interface LessonFactKey {
    /** The subject, in the shop's words. */
    readonly subjectLabel: string
    /** The attribute, in the shop's words. */
    readonly attributeLabel: string
}

/** One answered stop as a lesson candidate. */
export interface LessonCandidate extends LessonPlace {
    /** The candidate id. */
    readonly id: string
    /** The stop that was answered. */
    readonly stopId: string
    /** The run of the stop. */
    readonly runId: string
    /** The question the agent could not handle (masked). */
    readonly question: string
    /** Its significant words. */
    readonly keywords: ReadonlyArray<string>
    /** The person's words (masked). */
    readonly answer: string
    /** The member who answered. */
    readonly answeredBy: string
    /** When, ISO. */
    readonly answeredAt: string
    /** What the step then did. */
    readonly thenDid: LessonCandidateThen
    /** Whether the words state a general rule; null = not judged. */
    readonly general: boolean | null
    /** The group of the same gap. */
    readonly groupId: string
    /** Where it stands. */
    readonly status: LessonCandidateStatus
    /** The card that proposes its truth, or null. */
    readonly changeId: string | null
    /** The proposed truth's key, or null. */
    readonly factKey: LessonFactKey | null
    /** The truth in force once learned, or null. */
    readonly factId: string | null
}

/** An answered stop to keep as a candidate. */
export interface LessonCandidateInput extends LessonPlace {
    /** The stop. */
    readonly stopId: string
    /** The run. */
    readonly runId: string
    /** The question (raw: the store masks it). */
    readonly question: string
    /** The person's words (raw: the store masks them). */
    readonly answer: string
    /** The member who answered. */
    readonly answeredBy: string
    /** When, ISO. */
    readonly answeredAt: string
    /** What the step then did. */
    readonly thenDid: LessonCandidateThen
}

/** What keeping a candidate did. */
export interface LessonCandidateKept {
    /** The candidate as stored. */
    readonly candidate: LessonCandidate
    /** False when the same answer was already kept. */
    readonly isNew: boolean
}

/** How "too often" is judged (config). */
export interface StopLearningConfig {
    /** How many answered stops of the same gap make a group worth a truth. */
    readonly threshold: number
    /** How far back a group looks, days. */
    readonly windowDays: number
}

/** The defaults: two answered stops within 30 days. */
export const STOP_LEARNING_DEFAULTS: StopLearningConfig = { threshold: 2, windowDays: 30 }
