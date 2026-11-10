/** What saveAgentGraphLayout takes. */
export interface SaveAgentGraphLayoutRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose Graph page is laid out. */
    readonly installationId: string
    /** Where each workflow sits; replaces the saved layout whole. */
    readonly positions: ReadonlyArray<{ readonly workflowKey: string; readonly x: number; readonly y: number }>
}
