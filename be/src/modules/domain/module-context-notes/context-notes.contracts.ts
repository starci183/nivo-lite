/** Where a context note came from. */
export type ContextNoteSource = "office" | "setup"

/** Where a context note stands. */
export type ContextNoteStatus = "pending" | "applied" | "dismissed"

/** A note waiting to be applied into an installation's context. */
export interface ContextNote {
    /** The note. */
    readonly id: string
    /** The installation it supplements. */
    readonly installationId: string
    /** The note text. */
    readonly body: string
    /** Office or the setup chat. */
    readonly source: ContextNoteSource
    /** Who wrote it. */
    readonly authorName: string
    /** The role they held. */
    readonly authorRole: string
    /** pending, applied or dismissed. */
    readonly status: ContextNoteStatus
    /** When it was written, ISO 8601. */
    readonly createdAt: string
}

/** A dismissed note, enough to take its fact out of the open draft. */
export interface DismissedNote {
    /** The installation whose draft holds the fact. */
    readonly installationId: string
    /** The fact key the note added to the draft. */
    readonly factKey: string
}
