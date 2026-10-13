/** A generated script applied to the project that owns its generation. */
export interface VideoProjectScriptFinish {
    /** Workspace boundary. */
    readonly workspaceId: string
    /** Project identity. */
    readonly projectId: string
    /** Generation that still owns this project. */
    readonly generationId: string
    /** Serialized scenes. */
    readonly script: string
    /** Elapsed script time. */
    readonly durationMs: number
    /** Automatic title replacement, or null. */
    readonly title: string | null
    /** Serialized operation metadata. */
    readonly meta: string
}

/** A failed script applied only while its generation still owns the project. */
export interface VideoProjectScriptFailure {
    /** Workspace boundary. */
    readonly workspaceId: string
    /** Project identity. */
    readonly projectId: string
    /** Generation that still owns this project. */
    readonly generationId: string
    /** Stable code saved on the project. */
    readonly code: string
    /** Serialized operation metadata. */
    readonly meta: string
}
