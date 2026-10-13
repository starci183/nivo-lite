/** Fields a checked manager supplies for a new project. */
export interface NewVideoProjectDraft {
    /** Working title. */
    readonly title?: string
    /** Business goal. */
    readonly goal: string
    /** Output shape. */
    readonly aspect: string
    /** Target duration. */
    readonly targetSeconds: number
    /** Workspace checked sources and media. */
    readonly inputs?: unknown
}

/** Optional changes a checked manager applies to an idle project. */
export interface ChangeVideoProjectDraft {
    /** New title. */
    readonly title?: string
    /** New goal. */
    readonly goal?: string
    /** New shape. */
    readonly aspect?: string
    /** New duration. */
    readonly targetSeconds?: number
    /** Workspace checked inputs. */
    readonly inputs?: unknown
    /** Workspace checked scenes. */
    readonly script?: unknown
}

/** A newly saved project identity, or a rejected write. */
export type WrittenVideoProjectId = string | null
