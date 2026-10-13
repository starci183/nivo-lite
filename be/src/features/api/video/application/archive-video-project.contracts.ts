/** Authenticated archiveVideoProject request. */
export interface ArchiveVideoProjectRequest {
    /** Active workspace selector. */
    readonly workspaceId: string
    /** projectId selector. */
    readonly projectId: string
    /** archived selector. */
    readonly archived: boolean
}

/** Successful archiveVideoProject result. */
