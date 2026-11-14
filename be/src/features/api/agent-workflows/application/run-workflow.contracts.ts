/** What runWorkflow takes: the workflow of an installed agent, its inputs as its declared contract takes them, and the once-only key. */
export interface RunWorkflowRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflow. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** The inputs. */
    readonly inputs: Readonly<Record<string, unknown>>
    /** One stable key per intended start, reused on its retries. */
    readonly opKey: string
}

/** What runnableWorkflow takes. */
export interface RunnableWorkflowRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The installation whose agent holds the workflow. */
    readonly installationId: string
    /** The workflow. */
    readonly workflowId: string
    /** The language of the names; Vietnamese unless en is named. */
    readonly locale?: string | null | undefined
}
