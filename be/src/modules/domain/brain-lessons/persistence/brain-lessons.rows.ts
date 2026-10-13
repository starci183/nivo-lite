import type { LessonEvidence, LessonOrigin, LessonStatus } from "../brain-lessons.contracts"

/** One row of public.brain_lessons; timestamps arrive as Date or text depending on the driver. */
export interface BrainLessonRow {
    /** The lesson id. */
    readonly id: string
    /** The agent it is for, or null. */
    readonly module: string | null
    /** The title. */
    readonly title: string
    /** What to do. */
    readonly body: string
    /** When it applies. */
    readonly applies_when: string
    /** Where it stands. */
    readonly status: LessonStatus
    /** What it was learnt from. */
    readonly origin: LessonOrigin
    /** The evidence list. */
    readonly evidence: ReadonlyArray<LessonEvidence> | null
    /** Its version. */
    readonly version: number
    /** The lesson it replaces. */
    readonly supersedes_id: string | null
    /** Who proposed it. */
    readonly proposed_by: string
    /** When it was proposed. */
    readonly proposed_at: Date | string
    /** Who decided it. */
    readonly decided_by: string | null
    /** When it was decided. */
    readonly decided_at: Date | string | null
}

/** The version of a lesson. */
export interface LessonVersionRow {
    /** The version. */
    readonly version: number
}
