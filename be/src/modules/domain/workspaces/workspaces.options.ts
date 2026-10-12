/** What the workspaces capability needs from its environment, parsed once at the composition root. */
export interface WorkspacesOptions {
    /** Whether a person with no workspace may create a free one (local and demo environments only). */
    readonly allowFreeWorkspace: boolean
}
