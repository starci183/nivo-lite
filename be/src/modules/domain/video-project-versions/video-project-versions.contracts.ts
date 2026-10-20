/** The snapshot of a project at the moment a render started. */
export interface ProjectVersion {
    /** The project. */
    readonly projectId: string
    /** The workspace it belongs to. */
    readonly workspaceId: string
    /** The version number the snapshot keeps. */
    readonly version: number
    /** The script as JSON text. */
    readonly script: string
    /** The validated spec as JSON text. */
    readonly spec: string
    /** The render the version started. */
    readonly renderId: string
    /** The person who asked for it, or null when an agent did (AI Editor on a delegated script). */
    readonly createdBy: string | null
}
