/** What reading one module takes: its key. */
export interface GetModuleRequest {
    /** The key of the module to read. */
    readonly key: string
    /** The workspace that reads it (the caller must be a member); needed only for a module of a private plugin. Null: none named. */
    readonly workspaceId: string | null
}
