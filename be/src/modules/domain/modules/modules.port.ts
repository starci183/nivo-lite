/** A capability that keeps records naming the installation they belong to: the port the record owners implement for the modules capability. */
export interface RecordInstallationSource {
    /** The installation the record of the workspace names, or null when the id is none of the owner's rows or the row names no installation. */
    installationIdOf(workspaceId: string, recordId: string): Promise<string | null>
}
