/** The run a worker finishes and the fence it holds: the write lands only while the platform still gives it this job and token. */
export interface LeadActionFenceType {
    /** The run id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The job whose fence the worker holds. */
    readonly jobId: string
    /** The fencing token of the worker. */
    readonly fencingToken: number
}
