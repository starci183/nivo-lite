/** What the AcceptTemplateUpdate operation takes. */
export interface AcceptTemplateUpdateRequest {
    /** The workspaceId. */
    readonly workspaceId: string
    /** The installationId. */
    readonly installationId: string
    /** The unitIds. */
    readonly unitIds: ReadonlyArray<string>
}
