import type { LessonEvidence } from "@modules/domain/brain-lessons"

/** One lesson. */
export class LessonResponse {
    /** The lesson id. */
    id!: string
    /** The agent it is for, or null for every agent. */
    module!: string | null
    /** The title. */
    title!: string
    /** What to do. */
    body!: string
    /** When it applies. */
    appliesWhen!: string
    /** Where it stands. */
    status!: string
    /** What it was learnt from. */
    origin!: string
    /** What supports it. */
    evidence!: ReadonlyArray<LessonEvidence>
    /** Its version. */
    version!: number
    /** Who proposed it. */
    proposedBy!: string
    /** When it was proposed. */
    proposedAt!: string
    /** Who decided it. */
    decidedBy!: string | null
    /** When it was decided. */
    decidedAt!: string | null
}

/** What studying the corrections did. */
export class MineResponse {
    /** How many corrections there were. */
    corrections!: number
    /** How many were kept as new regression cases. */
    newCases!: number
    /** How many lessons were proposed. */
    proposed!: number
    /** Why nothing was proposed, when so. */
    reason?: string
}
