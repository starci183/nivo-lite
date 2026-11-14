/** What setAgentNodeMode takes. */
export interface SetAgentNodeModeRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflow. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** The node, by its key in the workflow's running graph. */
    readonly nodeKey: string
    /** `auto` or `ask`. */
    readonly mode: string
    /** The newest version number the caller read; a newer one refuses the change. */
    readonly expectedLatest?: number | null
}
