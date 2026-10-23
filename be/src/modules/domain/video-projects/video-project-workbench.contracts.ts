/** Fields a checked manager supplies for a new project. */
export interface NewVideoProjectDraft {
    /** Working title. */
    readonly title?: string | undefined
    /** Business goal. */
    readonly goal: string
    /** Output shape. */
    readonly aspect: string
    /** Target duration. */
    readonly targetSeconds: number
    /** Workspace checked sources and media. */
    readonly inputs?: unknown
}

/** The project AI Editor makes of a script another agent delegated. */
export interface DelegatedVideoProjectDraft {
    /** The title. */
    readonly title: string
    /** Business goal. */
    readonly goal: string
    /** Output shape. */
    readonly aspect: string
    /** Target duration. */
    readonly targetSeconds: number
    /** The scenes, stored as they are. */
    readonly script: unknown
}

/** Optional changes a checked manager applies to an idle project. */
export interface ChangeVideoProjectDraft {
    /** New title. */
    readonly title?: string | undefined
    /** New goal. */
    readonly goal?: string | undefined
    /** New shape. */
    readonly aspect?: string | undefined
    /** New duration. */
    readonly targetSeconds?: number | undefined
    /** Workspace checked inputs. */
    readonly inputs?: unknown
    /** Workspace checked scenes. */
    readonly script?: unknown
}

/** A newly saved project identity, or a rejected write. */
export type WrittenVideoProjectId = string | null
