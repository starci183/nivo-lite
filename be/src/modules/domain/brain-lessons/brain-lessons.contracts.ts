/** Where a lesson stands: only an active lesson reaches an agent. */
export type LessonStatus = "proposed" | "active" | "retired" | "rejected"

/** What a lesson was learnt from. */
export type LessonOrigin = "edits" | "note" | "outcome" | "manual"

/** Where a piece of lesson evidence came from. */
export interface LessonEvidence {
    /** The kind of evidence. */
    readonly kind: string
    /** The row it points at. */
    readonly ref: string
    /** A short label for people. */
    readonly label: string
    /** When it happened. */
    readonly at?: string | undefined
}

/** How an agent should work (procedural memory). */
export interface LessonRecord {
    /** The lesson id. */
    readonly id: string
    /** The agent it is for; null = every agent. */
    readonly module: string | null
    /** The short title. */
    readonly title: string
    /** What to do. */
    readonly body: string
    /** When it applies. */
    readonly appliesWhen: string
    /** Where it stands. */
    readonly status: LessonStatus
    /** What it was learnt from. */
    readonly origin: LessonOrigin
    /** What supports it. */
    readonly evidence: ReadonlyArray<LessonEvidence>
    /** Its version. */
    readonly version: number
    /** Who proposed it. */
    readonly proposedBy: string
    /** When it was proposed. */
    readonly proposedAt: string
    /** Who decided it. */
    readonly decidedBy: string | null
    /** When it was decided. */
    readonly decidedAt: string | null
}

/** A lesson to propose. */
export interface LessonInput {
    /** The agent it is for; null = every agent. */
    readonly module: string | null
    /** The short title. */
    readonly title: string
    /** What to do. */
    readonly body: string
    /** When it applies. */
    readonly appliesWhen?: string | undefined
    /** What it was learnt from. */
    readonly origin: LessonOrigin
    /** What supports it. */
    readonly evidence?: ReadonlyArray<LessonEvidence>
    /** Who proposed it. */
    readonly proposedBy: string
    /** A person writing a lesson by hand applies it at once. */
    readonly apply?: boolean
    /** The lesson this one replaces (a new version). */
    readonly supersedesId?: string | null
}

/** The verdict on a proposed lesson. */
export type LessonVerdict = "active" | "rejected"
