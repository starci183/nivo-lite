/** The durable queue of the asynchronous lead actions. */
export const LEAD_ACTIONS_QUEUE = "lead_actions"

/** The job run by the lead-actions consumer. */
export const RUN_LEAD_ACTION_JOB = "lead-actions.run"

/** The address of a backend-owned lead action run. */
export interface LeadActionPayload {
    /** The workspace the GraphQL caller proved membership in. */
    readonly workspaceId: string
    /** The run whose stored input the worker uses. */
    readonly runId: string
}

/** True for a delivery that addresses a lead action run. */
export const isLeadActionPayload = (value: unknown): value is LeadActionPayload =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "runId" in value &&
    typeof value.runId === "string"
